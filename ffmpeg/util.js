export async function fetchFile(file) {
  if (file instanceof Uint8Array) {
    return file;
  }

  if (file instanceof Blob) {
    return new Uint8Array(await file.arrayBuffer());
  }

  if (typeof file === "string" || file instanceof URL) {
    const response = await fetch(file);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  throw new TypeError("Unsupported file input type for fetchFile()");
}

export async function toBlobURL(url, mimeType) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load resource: ${url}`);
  }
  const data = await response.arrayBuffer();
  const blob = new Blob([data], { type: mimeType });
  return URL.createObjectURL(blob);
}
