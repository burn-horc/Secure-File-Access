function resolveTone(status) {
  if (status === "success" || status === "error" || status === "info") {
    return status;
  }
  return "info";
}

export function showAppToast(toast, options) {
  const {
    id,
    title,
    description,
    status = "info",
    duration,
    position = "bottom-right",
    keepOpen = false,
  } = options ?? {};

  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  if (!toast || !normalizedTitle) return;

  if (id && toast.isActive?.(id)) {
    return;
  }

  const tone = resolveTone(status);

  toast({
    id,
    duration:
      keepOpen || duration === null
        ? null
        : Number.isFinite(duration)
          ? duration
          : tone === "success"
            ? 1800
            : 2800,
    position,
    title: normalizedTitle,
    description,
    status: tone,
    isClosable: true,
    variant: "solid",
  });
}
