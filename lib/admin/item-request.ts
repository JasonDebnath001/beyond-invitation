import { MAX_PRODUCT_PHOTO_BYTES } from "./item-fields";
import { ItemCreateError } from "./item-create";

export async function readItemRequest(request: Request) {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const jsonLimit = 256 * 1024;
  const multipart = type === "multipart/form-data";
  if (!multipart && type !== "application/json")
    throw new ItemCreateError("Send item details as JSON or a photo upload.", 415);
  if (Number(request.headers.get("content-length")) > (multipart ? MAX_PRODUCT_PHOTO_BYTES + 512 * 1024 : jsonLimit))
    throw new ItemCreateError("Item details or photo are too large.", 413);
  let text: string;
  let photo: File | undefined;
  if (multipart) {
    let form: FormData;
    try { form = await request.formData(); }
    catch { throw new ItemCreateError("Could not read the photo upload."); }
    const payload = form.get("payload");
    if (typeof payload !== "string") throw new ItemCreateError("Enter item details.");
    text = payload;
    const file = form.get("photo");
    if (!(file instanceof File) || !file.size) throw new ItemCreateError("Choose a photo to upload.");
    if (file.size > MAX_PRODUCT_PHOTO_BYTES) throw new ItemCreateError("Choose a photo up to 3 MB.", 413);
    photo = file;
  } else text = await request.text();
  if (Buffer.byteLength(text, "utf8") > jsonLimit) throw new ItemCreateError("Item details are too large.", 413);
  try { return { body: JSON.parse(text) as unknown, photo }; }
  catch { throw new ItemCreateError("Send valid item details."); }
}
