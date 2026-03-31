import axios from 'axios';
import {
  getDatastreamHeaders,
  getHostHeaders,
  getAccessToken,
  getTenantId,
} from '../config/auth';
import { getDatastreamBaseUrl, getHostBaseUrl } from '../config/urls';

/** Datastream API GET */
export async function datastreamGet(path: string, params?: Record<string, unknown>) {
  const url = `${getDatastreamBaseUrl()}${path}`;
  return axios.get(url, { headers: getDatastreamHeaders(), params });
}

/** Datastream API POST */
export async function datastreamPost(
  path: string,
  body: unknown,
  responseType?: 'blob'
) {
  const url = `${getDatastreamBaseUrl()}${path}`;
  return axios.post(url, body, {
    headers: getDatastreamHeaders(),
    ...(responseType ? { responseType } : {}),
  });
}

/** Host API GET (task polling, distributor meta) */
export async function hostGet(path: string) {
  const url = `${getHostBaseUrl()}${path}`;
  return axios.get(url, { headers: getHostHeaders() });
}

/** Host API POST (task creation) */
export async function hostPost(path: string, body: unknown) {
  const url = `${getHostBaseUrl()}${path}`;
  return axios.post(url, body, { headers: getHostHeaders() });
}

/**
 * Download a report file by URL.
 * Handles Content-Disposition filename extraction and triggers browser download.
 */
export async function fetchAndDownloadReport(fileUrl: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(fileUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      lob: getTenantId(),
    },
  });

  if (!response.ok) throw new Error('Download failed');

  const contentDisposition = response.headers.get('Content-Disposition');
  let fileName = 'download';
  if (contentDisposition?.includes('filename=')) {
    fileName = contentDisposition.split('filename=')[1].split(';')[0].trim().replace(/"/g, '');
  } else {
    fileName = fileUrl.split('/').pop() || 'download';
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}
