import { notFoundError } from "@/server/http";

/** Unknown API paths: a no-store 404 that no CDN keeps (stage 7 PT-11; Next's default 404 is cached for a year). */
const notFound = async (): Promise<Response> => notFoundError();

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
