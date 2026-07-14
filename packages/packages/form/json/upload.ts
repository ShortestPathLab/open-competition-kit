import type { FileRef } from "@open-competition-kit/sdk";

export type UploadProgress = { loaded: number; total: number };

/**
 * Take a browser File all the way to a `FileRef` the form can submit.
 *
 * Three steps, and the middle one is the point:
 *
 *   1. claim a key      → the server derives it; the client never picks it
 *   2. send the bytes   → straight to the bucket if the backend presigned a URL,
 *                         otherwise proxied through the app
 *   3. seal it          → the server checks what actually arrived
 *
 * Step 2 is why the S3 backend exists: a multi-gigabyte upload never touches the
 * app server. Step 3 is why a client cannot claim a key, upload nothing, and
 * submit a reference to a file that does not exist.
 */
export async function upload(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<FileRef> {
  const claim = await fetch("/api/files/request-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });

  if (!claim.ok) throw new Error(await errorOf(claim));

  const { key, url } = (await claim.json()) as {
    key: string;
    url: string | null;
  };

  // A presigned PUT goes straight to storage; otherwise the app proxies it.
  const target = url ?? `/api/files/upload?key=${encodeURIComponent(key)}`;
  await send(target, file, onProgress);

  const sealed = await fetch("/api/files/complete-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  });

  if (!sealed.ok) throw new Error(await errorOf(sealed));

  return (await sealed.json()) as FileRef;
}

async function errorOf(res: Response) {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Upload failed (${res.status})`;
  } catch {
    return `Upload failed (${res.status})`;
  }
}

/**
 * XHR rather than fetch: `fetch` cannot report upload progress, and a participant
 * pushing a large archive over a slow connection needs to see that it is moving.
 */
function send(
  url: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader(
      "content-type",
      file.type || "application/octet-stream",
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.({ loaded: e.loaded, total: e.total });
      }
    };

    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ?
        resolve()
      : reject(new Error(`Upload failed (${xhr.status})`));

    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}
