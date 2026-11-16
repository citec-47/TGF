export const MAX_WEEK_CONTENT_CHARACTERS = 30000;

export function validateGeneratedCurriculum(value, expectedModuleCount) {
  if (!Number.isInteger(expectedModuleCount) || expectedModuleCount < 1 || expectedModuleCount > 8) {
    return { error: "Choose a course duration between 1 and 8 modules." };
  }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !Array.isArray(value.modules) || value.modules.length !== expectedModuleCount) {
    return { error: `The generated draft must contain exactly ${expectedModuleCount} modules.` };
  }
  if (value.sourceExtractionFallback !== undefined &&
      typeof value.sourceExtractionFallback !== "boolean") {
    return { error: "The generated draft has invalid source extraction status." };
  }

  const modules = [];
  for (const [moduleIndex, module] of value.modules.entries()) {
    if (!module || typeof module !== "object" || Array.isArray(module) ||
        typeof module.title !== "string" || module.title.trim().length < 2 ||
        module.title.trim().length > 120 ||
        typeof module.description !== "string" || module.description.length > 1000 ||
        typeof module.capstonePrompt !== "string" || module.capstonePrompt.trim().length < 20 ||
        module.capstonePrompt.trim().length > 5000 ||
        !Array.isArray(module.weeks) || module.weeks.length !== 4) {
      return { error: `Module ${moduleIndex + 1} has invalid details or does not contain four weekly blocks.` };
    }

    const weeks = [];
    for (const [weekIndex, week] of module.weeks.entries()) {
      const sourcePageStart = week?.sourcePageStart ?? null;
      const sourcePageEnd = week?.sourcePageEnd ?? null;
      if (!week || typeof week !== "object" || Array.isArray(week) ||
          typeof week.title !== "string" || week.title.trim().length < 2 ||
          week.title.trim().length > 120 ||
          typeof week.description !== "string" || week.description.length > 1200 ||
          typeof week.learningObjectives !== "string" || week.learningObjectives.length > 2000 ||
          typeof week.lessonContent !== "string" || week.lessonContent.trim().length < 20 ||
          week.lessonContent.length > MAX_WEEK_CONTENT_CHARACTERS ||
          !(
            sourcePageStart === null && sourcePageEnd === null ||
            Number.isInteger(sourcePageStart) && sourcePageStart > 0 &&
            Number.isInteger(sourcePageEnd) && sourcePageEnd >= sourcePageStart
          )) {
        return { error: `Module ${moduleIndex + 1}, week ${weekIndex + 1} has invalid lesson details.` };
      }
      const normalizedWeek = {
        title: week.title.trim(),
        description: week.description.trim(),
        learningObjectives: week.learningObjectives.trim(),
        lessonContent: week.lessonContent.trim(),
        sourcePageStart,
        sourcePageEnd,
      };
      if (week.days !== undefined) {
        if (!Array.isArray(week.days) || week.days.length !== 5) {
          return { error: `Module ${moduleIndex + 1}, week ${weekIndex + 1} must contain five study days.` };
        }
        const days = [];
        for (const [dayIndex, day] of week.days.entries()) {
          const dayPageStart = day?.sourcePageStart ?? null;
          const dayPageEnd = day?.sourcePageEnd ?? null;
          if (!day || typeof day !== "object" || Array.isArray(day) ||
              day.dayNumber !== dayIndex + 1 ||
              typeof day.title !== "string" || day.title.trim().length < 2 ||
              day.title.trim().length > 120 ||
              typeof day.lessonContent !== "string" || day.lessonContent.trim().length < 20 ||
              day.lessonContent.length > MAX_WEEK_CONTENT_CHARACTERS ||
              !(
                dayPageStart === null && dayPageEnd === null ||
                Number.isInteger(dayPageStart) && dayPageStart > 0 &&
                Number.isInteger(dayPageEnd) && dayPageEnd >= dayPageStart
              )) {
            return { error: `Module ${moduleIndex + 1}, week ${weekIndex + 1}, day ${dayIndex + 1} has invalid lesson details.` };
          }
          days.push({
            dayNumber: day.dayNumber,
            title: day.title.trim(),
            lessonContent: day.lessonContent.trim(),
            sourcePageStart: dayPageStart,
            sourcePageEnd: dayPageEnd,
          });
        }
        normalizedWeek.days = days;
      }
      weeks.push(normalizedWeek);
    }

    modules.push({
      title: module.title.trim(),
      description: module.description.trim(),
      capstonePrompt: module.capstonePrompt.trim(),
      weeks,
    });
  }

  return {
    curriculum: {
      ...(value.sourceExtractionFallback ? { sourceExtractionFallback: true } : {}),
      modules,
    },
  };
}

