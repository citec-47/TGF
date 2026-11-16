const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEDIA_TYPES = new Set(["article", "announcement", "event", "publication", "photo", "video"]);

/**
 * @typedef {{
 *   heroIntro: string,
 *   foundedDate: string,
 *   about: { intro: string, vision: string, mission: string, objectives: string[], values: { name: string, description: string }[] },
 *   subsidiaries: { name: string, description: string, website: string }[],
 *   tgfea: { intro: string, structure: string, schedule: string, objectives: string[], awardCategories: string[] },
 *   tgfvp: { intro: string, courses: string[], duration: string, cycle: string, completion: string, graduation: string, locations: string, schedule: string, certification: string, benefits: string[], admissionsPhone: string },
 *   newsroom: { intro: string, items: { type: string, title: string, date: string, summary: string, link: string, imageUrl: string }[] },
 *   careers: { intro: string, generalTitle: string, generalDescription: string, vacancies: { title: string, location: string, type: string, deadline: string, description: string, requirements: string, active: boolean }[] },
 *   community: { intro: string, points: string[] },
 *   contact: { headOffice: { name: string, address: string, phone: string, email: string }, branches: { name: string, address: string, phone: string }[], socials: { name: string, url: string }[] }
 * }} CorporateContent
 */

export const DEFAULT_CORPORATE_CONTENT = {
  heroIntro: "Founded in 2018, TGF Group brings together its businesses and social-impact programmes under the watchword “Base For Better Living.”",
  foundedDate: "Founded June 17, 2018",
  about: {
    intro: "Transgenerational Forces Group is committed to creating solutions that improve everyday life and build a lasting impact across generations. Alongside its subsidiaries, the Group’s Corporate Social Responsibility recognises, empowers and supports young dreams.",
    vision: "Create value today while inspiring generations to come.",
    mission: "Empower people, shape industries, and leave an enduring legacy.",
    objectives: [],
    values: [
      { name: "Service", description: "The essence of leadership is service. TGF values servant-hearted leadership." },
      { name: "Giving", description: "Give time, resources and effort to fulfill the mission and advance others." },
      { name: "Loyalty", description: "Unity and commitment protect the dignity and integrity of the company." },
      { name: "Discipline & Punctuality", description: "Discipline and punctuality reflect respect, professionalism and integrity." },
      { name: "Resilience", description: "Resilience keeps the vision alive through challenge and change." },
    ],
  },
  subsidiaries: [
    { name: "BEST RIDES", description: "Auto Services & Logistics", website: "" },
    { name: "DEHIVAS", description: "", website: "" },
    { name: "TGF Supersales", description: "", website: "" },
  ],
  tgfea: {
    intro: "Transgenerational Forces Empowerment & Awards (TGFEA) is a flagship annual programme by TGF Group, designed to empower, connect and recognise visionaries, entrepreneurs, nation builders and other impact-driven individuals across Africa and beyond.",
    structure: "Its two-day experience combines empowerment, networking and global recognition. Day one focuses on networking, collaboration and growth; day two is an awards and recognition ceremony.",
    schedule: "Held annually on the third Saturday and Sunday of January.",
    objectives: [
      "Empower individuals through structured training, mentorship and capacity building.",
      "Create an ecosystem for networking, collaboration and partnerships.",
      "Provide a platform for exhibiting skills, businesses and innovations.",
      "Recognise excellence across entrepreneurship, arts, media, faith and social impact.",
    ],
    awardCategories: [
      "Entrepreneurial Icon of the Year", "Startup of the Year", "Innovation of the Year",
      "Excellence in Leadership Award", "Youth Empowerment Icon", "Lifetime Achievement Award",
      "Best Media Influencer", "Best in Community Development", "Humanitarian of the Year",
      "Most Recommended Health Organization", "Best in Entrepreneurial Support",
      "Best Training / Educational Institution", "Artist of the Year", "Best in Conflict Resolution",
      "Best Music Group", "Best Music Producer", "Best Dance Crew", "Best Comedian",
      "People’s Choice Award", "Global Impact Award", "Best Customer Service Brand",
      "Best TV Station", "Best Fashion Brand", "Best in Web Development", "Best Video Director",
      "Best Movie Producer", "Best Record Label", "Best News / Promotion Platform",
      "Best Gospel Platform", "Life Changing Preacher of the Year",
      "Best Relationship / Marriage Counsellor", "Kid Art of the Year", "Hit Song of the Year",
      "Best Music Collaboration of the Year",
    ],
  },
  tgfvp: {
    intro: "TGF Vocational Pathways offers certified vocational programmes designed to equip participants with practical skills and industry-relevant knowledge through hands-on learning.",
    courses: [
      "Driving & Road Safety", "Electronics Maintenance", "Career Strategy & Entrepreneurship",
      "Auto Mechanics & Diagnostics", "Digital Marketing", "Software Engineering",
    ],
    duration: "12 months",
    cycle: "Each academic cycle begins on the first Monday of November.",
    completion: "Programmes are designed to be completed on or before September 30 of the following year.",
    graduation: "Graduation ceremonies are scheduled for the fourth Saturday of October each year.",
    locations: "TGF training centres in Douala and Yaounde, with online participation depending on participant needs and availability.",
    schedule: "Classes are generally held twice weekly, with sessions of approximately two hours. Schedules may be adjusted for programme or student needs.",
    certification: "Successful participants receive a TGF Group Certificate of Completion.",
    benefits: [
      "Job recommendations through referrals to recruiters, employers and industry partners.",
      "Connections to potential business investors, mentors and partners.",
      "Eligible graduates who volunteer with TGF for 12 months may qualify for business capital support.",
      "Visibility for business or personal projects through TGF platforms and networks.",
      "Potential consideration for TGFVEN (Vision Empowerment Network).",
      "Complimentary mentorship and partnership support for the first six months.",
    ],
    admissionsPhone: "+237 671 04 96 42",
  },
  newsroom: {
    intro: "Corporate announcements, programme updates, publications and event coverage will be published here.",
    items: [],
  },
  careers: {
    intro: "Current vacancies will be listed here when available. You may also submit a general application with your CV.",
    generalTitle: "General application",
    generalDescription: "Share your area of interest and attach your CV. An authorized administrator will receive your submission in the website inbox.",
    vacancies: [],
  },
  community: {
    intro: "Register your interest to hear about TGF Group programmes, events and opportunities to participate.",
    points: ["Programme updates", "Events and engagement opportunities", "Ways to participate"],
  },
  contact: {
    headOffice: { name: "", address: "", phone: "", email: "" },
    branches: [
      { name: "TGFVP training centre", address: "Yaounde — Nouvelle Route, Nkolbisson", phone: "" },
      { name: "TGFVP training centre", address: "Douala — Ancien No. 1, Akwa", phone: "" },
      { name: "TGFVP training centre", address: "Souza — TGF Junction, Potoki", phone: "" },
    ],
    socials: [],
  },
};

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readText(value, label, maximumLength, { required = false } = {}) {
  if (typeof value !== "string") return { error: `${label} must be text.` };
  const normalized = value.trim();
  if (required && !normalized) return { error: `${label} is required.` };
  if (normalized.length > maximumLength) {
    return { error: `${label} must be ${maximumLength} characters or fewer.` };
  }
  return { value: normalized };
}

function readUrl(value, label, { image = false } = {}) {
  const result = readText(value, label, 1000);
  if (result.error || !result.value) return result;
  if (image && /^\/[a-z\d/_%.-]*$/i.test(result.value)) return result;
  try {
    const url = new URL(result.value);
    if (url.protocol === "https:" || url.protocol === "http:") return result;
  } catch {
    return { error: `${label} must be an HTTP or HTTPS URL.` };
  }
  return { error: `${label} must be an HTTP or HTTPS URL.` };
}

function readList(value, label, maximumCount, readItem) {
  if (!Array.isArray(value) || value.length > maximumCount) {
    return { error: `${label} must be a list of no more than ${maximumCount} entries.` };
  }
  const items = [];
  for (let index = 0; index < value.length; index += 1) {
    const result = readItem(value[index], `${label} entry ${index + 1}`);
    if (result.error) return result;
    items.push(result.value);
  }
  return { value: items };
}

function textList(value, label, maximumCount = 100, maximumLength = 500) {
  return readList(value, label, maximumCount, (item, itemLabel) => {
    const result = readText(item, itemLabel, maximumLength, { required: true });
    return result.error ? result : { value: result.value };
  });
}

function readObject(value, label, fields) {
  if (!isRecord(value)) return { error: `${label} must be an object.` };
  const result = {};
  for (const [key, [fieldLabel, maximumLength, required]] of Object.entries(fields)) {
    const parsed = readText(value[key], `${label} ${fieldLabel}`, maximumLength, { required });
    if (parsed.error) return parsed;
    result[key] = parsed.value;
  }
  return { value: result };
}

function readLinkItems(value, label, fields) {
  return readList(value, label, 50, (item, itemLabel) => {
    if (!isRecord(item)) return { error: `${itemLabel} must be an object.` };
    const result = {};
    for (const [key, [fieldLabel, maximumLength, required]] of Object.entries(fields)) {
      const parsed = readText(item[key], `${itemLabel} ${fieldLabel}`, maximumLength, { required });
      if (parsed.error) return parsed;
      result[key] = parsed.value;
    }
    return { value: result };
  });
}

/**
 * @param {unknown} value
 * @returns {{ error: string; content?: never } | { error?: never; content: CorporateContent }}
 */
export function validateCorporateContent(value) {
  if (!isRecord(value)) return { error: "Enter valid corporate website content." };
  if (JSON.stringify(value).length > 200000) {
    return { error: "Corporate website content must be smaller than 200 KB." };
  }

  const heroIntro = readText(value.heroIntro, "Homepage introduction", 600, { required: true });
  if (heroIntro.error) return heroIntro;
  const foundedDate = readText(value.foundedDate, "Founding date", 100);
  if (foundedDate.error) return foundedDate;

  if (!isRecord(value.about)) return { error: "About Us content must be an object." };
  const about = {};
  for (const [key, label] of [["intro", "About Us introduction"], ["vision", "Vision"], ["mission", "Mission"]]) {
    const result = readText(value.about[key], label, 1500);
    if (result.error) return result;
    about[key] = result.value;
  }
  const objectives = textList(value.about.objectives, "Group objectives", 30, 500);
  if (objectives.error) return objectives;
  about.objectives = objectives.value;
  const values = readLinkItems(value.about.values, "Core values", {
    name: ["name", "100", true],
    description: ["description", "700", false],
  });
  if (values.error) return values;
  about.values = values.value;

  const subsidiaries = readLinkItems(value.subsidiaries, "Subsidiaries", {
    name: ["name", "120", true],
    description: ["description", "500", false],
    website: ["website", "1000", false],
  });
  if (subsidiaries.error) return subsidiaries;
  for (let index = 0; index < subsidiaries.value.length; index += 1) {
    const link = readUrl(subsidiaries.value[index].website, `Subsidiaries entry ${index + 1} website`);
    if (link.error) return link;
    subsidiaries.value[index].website = link.value;
  }

  if (!isRecord(value.tgfea)) return { error: "TGFEA content must be an object." };
  const tgfea = {};
  for (const [key, label] of [["intro", "TGFEA introduction"], ["structure", "TGFEA structure"], ["schedule", "TGFEA schedule"]]) {
    const result = readText(value.tgfea[key], label, 2000);
    if (result.error) return result;
    tgfea[key] = result.value;
  }
  for (const [key, label, maxLength] of [
    ["objectives", "TGFEA objectives", 500],
    ["awardCategories", "TGFEA award categories", 150],
  ]) {
    const result = textList(value.tgfea[key], label, 50, maxLength);
    if (result.error) return result;
    tgfea[key] = result.value;
  }

  if (!isRecord(value.tgfvp)) return { error: "TGFVP content must be an object." };
  const tgfvp = {};
  for (const [key, label] of [
    ["intro", "TGFVP introduction"], ["duration", "Programme duration"], ["cycle", "Academic cycle"],
    ["completion", "Programme completion"], ["graduation", "Graduation schedule"],
    ["locations", "Training locations"], ["schedule", "Class schedule"],
    ["certification", "Certification details"], ["admissionsPhone", "Admissions phone"],
  ]) {
    const result = readText(value.tgfvp[key], label, 1500);
    if (result.error) return result;
    tgfvp[key] = result.value;
  }
  const courses = textList(value.tgfvp.courses, "TGFVP courses", 30, 150);
  if (courses.error) return courses;
  tgfvp.courses = courses.value;
  const benefits = textList(value.tgfvp.benefits, "TGFVP benefits", 30, 700);
  if (benefits.error) return benefits;
  tgfvp.benefits = benefits.value;

  if (!isRecord(value.newsroom)) return { error: "News and media content must be an object." };
  const newsroomIntro = readText(value.newsroom.intro, "News and media introduction", 1000);
  if (newsroomIntro.error) return newsroomIntro;
  const newsItems = readList(value.newsroom.items, "News and media", 50, (item, label) => {
    if (!isRecord(item)) return { error: `${label} must be an object.` };
    const type = readText(item.type, `${label} type`, 20, { required: true });
    if (type.error || !MEDIA_TYPES.has(type.value)) return { error: `${label} must have a valid media type.` };
    const title = readText(item.title, `${label} title`, 160, { required: true });
    if (title.error) return title;
    const date = readText(item.date, `${label} date`, 100);
    if (date.error) return date;
    const summary = readText(item.summary, `${label} summary`, 1200, { required: true });
    if (summary.error) return summary;
    const link = readUrl(item.link, `${label} link`);
    if (link.error) return link;
    const imageUrl = readUrl(item.imageUrl, `${label} image URL`, { image: true });
    if (imageUrl.error) return imageUrl;
    return { value: { type: type.value, title: title.value, date: date.value, summary: summary.value, link: link.value, imageUrl: imageUrl.value } };
  });
  if (newsItems.error) return newsItems;

  if (!isRecord(value.careers)) return { error: "Careers content must be an object." };
  const careers = {};
  for (const [key, label, maxLength] of [
    ["intro", "Careers introduction", 1000], ["generalTitle", "General application title", 120],
    ["generalDescription", "General application description", 1000],
  ]) {
    const result = readText(value.careers[key], label, maxLength);
    if (result.error) return result;
    careers[key] = result.value;
  }
  const vacancies = readList(value.careers.vacancies, "Vacancies", 50, (item, label) => {
    if (!isRecord(item) || typeof item.active !== "boolean") {
      return { error: `${label} must include a publication status.` };
    }
    const result = {};
    for (const [key, fieldLabel, maximumLength, required] of [
      ["title", "title", 160, true], ["location", "location", 160, false], ["type", "employment type", 100, false],
      ["deadline", "application deadline", 100, false], ["description", "description", 2000, true],
      ["requirements", "requirements", 2000, false],
    ]) {
      const parsed = readText(item[key], `${label} ${fieldLabel}`, maximumLength, { required });
      if (parsed.error) return parsed;
      result[key] = parsed.value;
    }
    result.active = item.active;
    return { value: result };
  });
  if (vacancies.error) return vacancies;
  careers.vacancies = vacancies.value;

  if (!isRecord(value.community)) return { error: "Community content must be an object." };
  const communityIntro = readText(value.community.intro, "Community introduction", 1000);
  if (communityIntro.error) return communityIntro;
  const communityPoints = textList(value.community.points, "Community information", 30, 300);
  if (communityPoints.error) return communityPoints;

  if (!isRecord(value.contact)) return { error: "Contact details must be an object." };
  const headOffice = readObject(value.contact.headOffice, "Head office", {
    name: ["name", 160, false],
    address: ["address", 500, false],
    phone: ["phone", 40, false],
    email: ["email", 254, false],
  });
  if (headOffice.error) return headOffice;
  if (headOffice.value.email && !EMAIL_PATTERN.test(headOffice.value.email)) {
    return { error: "Enter a valid head office email address." };
  }
  const branches = readLinkItems(value.contact.branches, "Branches", {
    name: ["name", "160", true],
    address: ["address", "500", false],
    phone: ["phone", "40", false],
  });
  if (branches.error) return branches;
  const socials = readLinkItems(value.contact.socials, "Social links", {
    name: ["name", "120", true],
    url: ["URL", "1000", true],
  });
  if (socials.error) return socials;
  for (let index = 0; index < socials.value.length; index += 1) {
    const link = readUrl(socials.value[index].url, `Social links entry ${index + 1} URL`);
    if (link.error) return link;
    socials.value[index].url = link.value;
  }

  const content = {
    heroIntro: heroIntro.value,
    foundedDate: foundedDate.value,
    about,
    subsidiaries: subsidiaries.value,
    tgfea,
    tgfvp,
    newsroom: { intro: newsroomIntro.value, items: newsItems.value },
    careers,
    community: { intro: communityIntro.value, points: communityPoints.value },
    contact: { headOffice: headOffice.value, branches: branches.value, socials: socials.value },
  };
  return { content };
}
