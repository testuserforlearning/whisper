import fetch from 'node-fetch';
import { FetchOptions } from '../../shared/types';

type FetchResult = {
  status: number;
  headers: Record<string,string>;
  buffer: Buffer;
};

export async function fetchThroughBareMux(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  try {
    const bareMux = require('bare-mux');
    if (bareMux && typeof bareMux.fetch === 'function') {
      const res = await bareMux.fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body
      });
      const arr = await res.arrayBuffer();
      const buffer = Buffer.from(arr);
      const headers: Record<string,string> = {};
      res.headers.forEach((v:string,k:string)=>headers[k]=v);
      return { status: res.status, headers, buffer };
    }
  } catch (err) {
  }

  const resp = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers as any || undefined,
    body: options.body as any || undefined,
    compress: false
  });
  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const headersObj: Record<string,string> = {};
  resp.headers.forEach((v,k)=> headersObj[k]=v);
  return { status: resp.status, headers: headersObj, buffer };
}

