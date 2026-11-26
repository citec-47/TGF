import {
  AccessToken,
  DataPacket_Kind,
  EncodedFileType,
  FileOutput,
  LiveKitAPI,
  Output,
  S3Upload,
  StartEgressRequest,
  StorageConfig,
  TemplateSource,
  TrackSource,
  WebhookReceiver,
} from "livekit-server-sdk";
import { S3Client } from "@aws-sdk/client-s3";
import { LIVE_CLASS_CONTROL_TOPIC } from "../lib/live-class-events.js";

let privateStorageCache;
let privateStorageCacheKey = "";

function requiredValue(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

export function getLiveKitConfig(env = process.env) {
  const publicUrl = requiredValue(env.LIVEKIT_URL, "LIVEKIT_URL");
  let parsedUrl;
  try {
    parsedUrl = new URL(publicUrl);
  } catch {
    throw new Error("LIVEKIT_URL must be a valid LiveKit WebSocket URL.");
  }
  if (!["ws:", "wss:"].includes(parsedUrl.protocol) || parsedUrl.search || parsedUrl.hash ||
      parsedUrl.username || parsedUrl.password || (parsedUrl.pathname !== "" && parsedUrl.pathname !== "/")) {
    throw new Error("LIVEKIT_URL must use ws:// or wss:// and must not include a query or fragment.");
  }
  if (env.NODE_ENV === "production" && parsedUrl.protocol !== "wss:") {
    throw new Error("LIVEKIT_URL must use wss:// in production.");
  }
  const apiProtocol = parsedUrl.protocol === "wss:" ? "https:" : "http:";
  return {
    publicUrl: `${parsedUrl.protocol}//${parsedUrl.host}`,
    apiHost: `${apiProtocol}//${parsedUrl.host}`,
    apiKey: requiredValue(env.LIVEKIT_API_KEY, "LIVEKIT_API_KEY"),
    apiSecret: requiredValue(env.LIVEKIT_API_SECRET, "LIVEKIT_API_SECRET"),
  };
}

export function createLiveKitParticipantToken(
  { identity, name, roomName, role, microphoneAllowed = false },
  env = process.env,
) {
  const config = getLiveKitConfig(env);
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name,
    ttl: "6h",
    metadata: JSON.stringify({ role }),
  });
  const canPublishSources = role === "teacher"
    ? [
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ]
    : role === "learner"
      ? [
        TrackSource.CAMERA,
        ...(microphoneAllowed ? [TrackSource.MICROPHONE] : []),
      ]
      : [];
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canSubscribe: true,
    canPublishData: role !== "administrator",
    canPublishSources,
  });
  return token.toJwt();
}

function getRecordingStorageConfig(env = process.env) {
  const endpoint = requiredValue(env.LIVE_RECORDING_S3_ENDPOINT, "LIVE_RECORDING_S3_ENDPOINT");
  let parsedEndpoint;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new Error("LIVE_RECORDING_S3_ENDPOINT must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsedEndpoint.protocol) || parsedEndpoint.username ||
      parsedEndpoint.password || (parsedEndpoint.pathname !== "" && parsedEndpoint.pathname !== "/")) {
    throw new Error("LIVE_RECORDING_S3_ENDPOINT must use HTTP or HTTPS.");
  }
  if (env.NODE_ENV === "production" && parsedEndpoint.protocol !== "https:") {
    throw new Error("LIVE_RECORDING_S3_ENDPOINT must use HTTPS in production.");
  }
  return {
    accessKeyId: requiredValue(env.LIVE_RECORDING_S3_ACCESS_KEY, "LIVE_RECORDING_S3_ACCESS_KEY"),
    secretAccessKey: requiredValue(env.LIVE_RECORDING_S3_SECRET, "LIVE_RECORDING_S3_SECRET"),
    bucket: requiredValue(env.LIVE_RECORDING_S3_BUCKET, "LIVE_RECORDING_S3_BUCKET"),
    region: requiredValue(env.LIVE_RECORDING_S3_REGION, "LIVE_RECORDING_S3_REGION"),
    endpoint: parsedEndpoint.origin,
  };
}

export function createLiveRecordingObjectKey(sessionId, env = process.env, now = Date.now()) {
  const prefix = (env.LIVE_RECORDING_S3_PREFIX || "tgfvp/live-classes")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9/_-]+$/.test(prefix) || prefix.split("/").includes("..")) {
    throw new Error("LIVE_RECORDING_S3_PREFIX may contain only letters, numbers, slashes, underscores, and hyphens.");
  }
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(sessionId)) {
    throw new Error("A valid live-session ID is required to create a recording key.");
  }
  return `${prefix}/${sessionId}/${now}.mp4`;
}

export function isLiveRecordingObjectKey(key, env = process.env) {
  const prefix = (env.LIVE_RECORDING_S3_PREFIX || "tgfvp/live-classes")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  return typeof key === "string" &&
    key.startsWith(`${prefix}/`) &&
    !key.split("/").includes("..") &&
    /^[a-zA-Z0-9/_-]+\.mp4$/.test(key);
}

export function getPrivateRecordingStorage(env = process.env) {
  const config = getRecordingStorageConfig(env);
  const cacheKey = JSON.stringify(config);
  if (privateStorageCache && privateStorageCacheKey === cacheKey) return privateStorageCache;
  privateStorageCache = {
    bucket: config.bucket,
    client: new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
  privateStorageCacheKey = cacheKey;
  return privateStorageCache;
}

function createLiveKitApi(env = process.env) {
  const config = getLiveKitConfig(env);
  return new LiveKitAPI({
    host: config.apiHost,
    apiKey: config.apiKey,
    secret: config.apiSecret,
  });
}

export async function startLiveKitRecording(roomName, objectKey, env = process.env) {
  return createLiveKitApi(env).egress.startEgress(
    createLiveKitRecordingRequest(roomName, objectKey, env),
  );
}

export function createLiveKitRecordingRequest(roomName, objectKey, env = process.env) {
  const storage = getRecordingStorageConfig(env);
  return new StartEgressRequest({
    roomName,
    source: {
      case: "template",
      value: new TemplateSource({ layout: "speaker" }),
    },
    outputs: [
      new Output({
        config: {
          case: "file",
          value: new FileOutput({
            fileType: EncodedFileType.MP4,
            filepath: objectKey,
          }),
        },
      }),
    ],
    storage: new StorageConfig({
      provider: {
        case: "s3",
        value: new S3Upload({
          accessKey: storage.accessKeyId,
          secret: storage.secretAccessKey,
          bucket: storage.bucket,
          region: storage.region,
          endpoint: storage.endpoint,
          forcePathStyle: true,
        }),
      },
    }),
  });
}

export async function stopLiveKitRecording(egressId, env = process.env) {
  return createLiveKitApi(env).egress.stopEgress(egressId);
}

export async function deleteLiveKitRoom(roomName, env = process.env) {
  return createLiveKitApi(env).room.deleteRoom(roomName);
}

export async function listLiveKitRoomParticipants(roomName, env = process.env) {
  return createLiveKitApi(env).room.listParticipants(roomName);
}

export async function setLiveKitParticipantMicrophonePermission(
  roomName,
  identity,
  microphoneAllowed,
  env = process.env,
) {
  const room = createLiveKitApi(env).room;
  const participant = await room.getParticipant(roomName, identity);
  const microphoneTrack = participant.tracks?.find(
    (track) => track.source === TrackSource.MICROPHONE,
  );
  if (!microphoneAllowed && microphoneTrack) {
    await room.mutePublishedTrack(roomName, identity, microphoneTrack.sid, true);
  }
  await room.updateParticipant(roomName, identity, {
    permission: {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: microphoneAllowed
        ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
        : [TrackSource.CAMERA],
    },
  });
  if (microphoneAllowed && microphoneTrack) {
    await room.mutePublishedTrack(roomName, identity, microphoneTrack.sid, false);
  }
}

export async function publishLiveClassControlEvent(roomName, event, env = process.env) {
  return createLiveKitApi(env).room.sendData(
    roomName,
    new TextEncoder().encode(JSON.stringify(event)),
    DataPacket_Kind.RELIABLE,
    { topic: LIVE_CLASS_CONTROL_TOPIC },
  );
}

export async function publishLiveClassChatMessage(roomName, messageId, env = process.env) {
  const message = new TextEncoder().encode(JSON.stringify({ messageId }));
  return createLiveKitApi(env).room.sendData(
    roomName,
    message,
    DataPacket_Kind.RELIABLE,
    { topic: "tgf-live-class-chat" },
  );
}

export async function verifyLiveKitWebhook(body, authorization, env = process.env) {
  const config = getLiveKitConfig(env);
  return new WebhookReceiver(config.apiKey, config.apiSecret).receive(body, authorization);
}
