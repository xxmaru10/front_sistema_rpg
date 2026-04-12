const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
const S3_BASE = `https://rpg-platform-free-assets-306337361114.s3.us-east-1.amazonaws.com`;

export function getPublicUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/audio/')) return path;
  return `${S3_BASE}/campaign-uploads/${path}`;
}

export async function listFiles(path: string = ''): Promise<{
  files: any[];
  folders: string[];
}> {
  try {
    const res = await fetch(`${API_BASE}/api/storage/list?path=${encodeURIComponent(path)}`);
    if (!res.ok) return { files: [], folders: [] };
    return res.json();
  } catch {
    return { files: [], folders: [] };
  }
}

export async function uploadToPath(file: File, path: string = ''): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(
    `${API_BASE}/api/storage/upload-to-path?path=${encodeURIComponent(path)}`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.publicUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/storage/delete?path=${encodeURIComponent(path)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Delete failed');
}

export async function moveFile(from: string, to: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/storage/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) throw new Error('Move failed');
}

export async function createFolder(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/storage/create-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error('Create folder failed');
}