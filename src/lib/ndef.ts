export interface DecodedNDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data: string;
  encoding?: string;
  lang?: string;
}

function toHex(bytes: Uint8Array): string {
  if (bytes.length === 0) return "[empty]";
  let out = "0x";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
    if (i < bytes.length - 1 && (i + 1) % 16 === 0) out += "\n";
    else if (i < bytes.length - 1) out += " ";
  }
  return out;
}

function toUtf8Safe(bytes: Uint8Array, encoding: string = "utf-8"): string {
  try {
    const decoder = new TextDecoder(encoding || "utf-8", { fatal: false });
    return decoder.decode(bytes);
  } catch {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(bytes);
  }
}

function getDataBytes(record: { data: unknown }): Uint8Array {
  try {
    const data = record.data;
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) {
      const v = data as ArrayBufferView;
      return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    }
    if (typeof data === "string") {
      const enc = new TextEncoder();
      return enc.encode(data);
    }
    if (data == null) return new Uint8Array();
    const dv = data as DataView;
    if (dv instanceof DataView) {
      return new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    }
    if (
      typeof data === "object" &&
      data !== null &&
      "buffer" in data &&
      (data as { buffer?: unknown }).buffer instanceof ArrayBuffer
    ) {
      const any = data as {
        buffer: ArrayBuffer;
        byteOffset?: number;
        byteLength?: number;
      };
      return new Uint8Array(
        any.buffer,
        any.byteOffset ?? 0,
        any.byteLength ?? any.buffer.byteLength
      );
    }
  } catch {
    /* fall through */
  }
  return new Uint8Array();
}

export function decodeTextRecord(record: {
  data: unknown;
  encoding?: string;
  lang?: string;
}): { text: string; lang?: string; encoding?: string } {
  try {
    const rawEncoding = (record.encoding as string)?.toLowerCase();
    const encoding = rawEncoding === "utf-16" ? "utf-16" : "utf-8";
    const bytes = getDataBytes(record);
    if (bytes.length === 0) {
      return { text: "", encoding };
    }

    // 1. In standard Web NFC (Chrome on Android), record.data is ALREADY
    // the plain text payload (status byte and language code are already
    // parsed by Chromium and exposed on record.encoding and record.lang).
    const directText = toUtf8Safe(bytes, encoding);
    const trimmed = directText.trim();
    if (
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed.includes("SafeCargo") ||
      (record as { lang?: string }).lang
    ) {
      return {
        text: directText,
        lang: (record as { lang?: string }).lang,
        encoding,
      };
    }

    // 2. Fallback: only if the first byte looks like a genuine IANA RTD-Text status byte:
    // The language code length in standard RTD-Text is always 1-15 ASCII chars (e.g. "en", "en-US").
    const status = bytes[0];
    const languageCodeLength = status & 0x3f;
    const isUtf16 = (status & 0x80) !== 0;
    const finalEncoding = isUtf16 ? "utf-16" : encoding;

    if (
      languageCodeLength > 0 &&
      languageCodeLength < 16 &&
      bytes.length > languageCodeLength + 1
    ) {
      const langBytes = bytes.slice(1, 1 + languageCodeLength);
      const isAsciiLang = Array.from(langBytes).every(
        (b) => (b >= 97 && b <= 122) || (b >= 65 && b <= 90) || b === 45
      );
      if (isAsciiLang) {
        const lang = new TextDecoder("us-ascii", { fatal: false })
          .decode(langBytes)
          .toLowerCase();
        const payload = bytes.slice(1 + languageCodeLength);
        const text = toUtf8Safe(payload, finalEncoding);
        return { text, lang, encoding: finalEncoding };
      }
    }

    return { text: directText, encoding: finalEncoding };
  } catch {
    return { text: "[Unable to decode text record]" };
  }
}

export function decodeUrlRecord(record: { data: unknown }): string {
  try {
    const bytes = getDataBytes(record);
    if (bytes.length === 0) return "";
    const prefixCode = bytes[0];
    const prefixes = [
      "",
      "http://www.",
      "https://www.",
      "http://",
      "https://",
      "tel:",
      "mailto:",
      "ftp://anonymous:anonymous@",
      "ftp://ftp.",
      "ftps://",
      "sftp://",
      "smb://",
      "nfs://",
      "ftp://",
      "dav://",
      "news:",
      "telnet://",
      "imap:",
      "rtsp://",
      "urn:",
      "pop:",
      "sip:",
      "sips:",
      "tftp:",
      "btspp://",
      "btl2cap://",
      "btgoep://",
      "tcpobex://",
      "irdaobex://",
      "file://",
      "urn:epc:id:",
      "urn:epc:tag:",
      "urn:epc:pat:",
      "urn:epc:raw:",
      "urn:nfc:",
    ];
    const prefix =
      prefixCode < prefixes.length ? prefixes[prefixCode] : "";
    const rest = toUtf8Safe(bytes.slice(1));
    return `${prefix}${rest}`;
  } catch {
    try {
      return toUtf8Safe(getDataBytes(record));
    } catch {
      return "[Unable to decode URL record]";
    }
  }
}

export async function decodeNDEFRecord(record: {
  recordType: string;
  mediaType?: string;
  id?: string;
  encoding?: string;
  data: unknown;
}): Promise<DecodedNDEFRecord> {
  const base: DecodedNDEFRecord = {
    recordType: String(record.recordType ?? "unknown"),
    mediaType: record.mediaType || undefined,
    id: record.id || undefined,
    data: "",
  };

  try {
    const type = base.recordType;

    if (type === "empty") {
      return { ...base, data: "[Empty NDEF record]" };
    }

    if (type === "text") {
      const { text, lang, encoding } = decodeTextRecord(record);
      return { ...base, data: text, lang, encoding };
    }

    if (type === "url") {
      return { ...base, data: decodeUrlRecord(record) };
    }

    if (type === "mime") {
      const bytes = getDataBytes(record);
      const mt = (base.mediaType || "").toLowerCase();
      if (mt.startsWith("text/") || mt === "application/json") {
        return { ...base, data: toUtf8Safe(bytes) };
      }
      try {
        const asText = toUtf8Safe(bytes);
        const printable = asText
          .split("")
          .filter((c) => c === "\n" || c === "\r" || c === "\t" || (c >= " " && c <= "~"))
          .join("");
        if (printable.length > 0 && printable.length / Math.max(1, asText.length) > 0.85) {
          return { ...base, data: asText };
        }
      } catch {
        /* use hex */
      }
      return { ...base, data: toHex(bytes) };
    }

    if (type === "absolute-url") {
      return { ...base, data: toUtf8Safe(getDataBytes(record)) };
    }

    if (type === "smart-poster") {
      const bytes = getDataBytes(record);
      return { ...base, data: toHex(bytes) };
    }

    const bytes = getDataBytes(record);
    const asText = toUtf8Safe(bytes);
    if (asText.length > 0) {
      const printableRatio =
        asText
          .split("")
          .filter((c) => c === "\n" || c === "\r" || c === "\t" || (c >= " " && c <= "~"))
          .join("").length / Math.max(1, asText.length);
      if (printableRatio > 0.8) {
        return { ...base, data: asText };
      }
    }
    return { ...base, data: toHex(bytes) };
  } catch {
    try {
      const bytes = getDataBytes(record);
      return { ...base, data: toHex(bytes) };
    } catch {
      return { ...base, data: "[Unable to decode record]" };
    }
  }
}
