import { auth } from "@/auth";
import { APPLE_HEALTH_MAX_UPLOAD_BYTES } from "@/lib/apple-health/constants";
import { runImport } from "@/lib/apple-health/import";

async function readXmlFromRequest(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") ?? form.get("export");
    if (typeof file === "string") return file;
    if (file && typeof (file as File).text === "function") {
      const blob = file as File;
      if (blob.size > APPLE_HEALTH_MAX_UPLOAD_BYTES) {
        throw new Error("Upload exceeds maximum allowed size");
      }
      return blob.text();
    }
    throw new Error("No file provided in multipart form");
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > APPLE_HEALTH_MAX_UPLOAD_BYTES) {
    throw new Error("Upload exceeds maximum allowed size");
  }
  const text = await request.text();
  if (text.length > APPLE_HEALTH_MAX_UPLOAD_BYTES) {
    throw new Error("Upload exceeds maximum allowed size");
  }
  return text;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let xml: string;
  try {
    xml = await readXmlFromRequest(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  if (!xml.trim().startsWith("<")) {
    return Response.json(
      { ok: false, error: "Body does not look like XML" },
      { status: 400 }
    );
  }

  try {
    const result = await runImport(session.user.id, xml, {
      trigger: "upload",
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
