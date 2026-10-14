import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildVideoFilter, MAX_VIDEO_BYTES, processVideoUpload, validateVideoUpload } from "./videoProcessing";

const execFileAsync = promisify(execFile);
let fixtureDirectory = "";
let sourceVideo = Buffer.alloc(0);
let smallSourceVideo = Buffer.alloc(0);

beforeAll(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), "yemreact-video-test-"));
  const fixturePath = join(fixtureDirectory, "source.mp4");
  await execFileAsync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", "color=c=0x202028:s=1280x720:d=1",
    "-f", "lavfi", "-i", "sine=frequency=880:duration=1",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", fixturePath,
  ]);
  sourceVideo = await readFile(fixturePath);
  const smallFixturePath = join(fixtureDirectory, "source-small.mp4");
  await execFileAsync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0x202028:s=640x360:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", smallFixturePath]);
  smallSourceVideo = await readFile(smallFixturePath);
}, 30_000);

afterAll(async () => {
  if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
});

describe("معالجة فيديو YemReact", () => {
  it("يبني مرشح تحويل نظيفًا بلا أي علامة مائية أو نص مرسوم", () => {
    const filter = buildVideoFilter();
    expect(filter).toContain("scale=");
    expect(filter).not.toContain("drawtext");
    expect(filter).not.toContain("يمن رياكت");
  });

  it("ينتج MP4 عالي الجودة H.264 مع AAC ومصغرة ويحافظ على 720p", async () => {
    expect(sourceVideo.length).toBeGreaterThan(0);
    expect(sourceVideo.length).toBeLessThan(MAX_VIDEO_BYTES);
    const written: Array<{ key: string; data: Buffer; type: string }> = [];
    const result = await processVideoUpload({ data: sourceVideo, fileName: "مقطع تجريبي.mp4", contentType: "video/mp4", storagePrefix: "tests/video" }, {
      put: async (key, data, type) => {
        written.push({ key, data: Buffer.from(data), type });
        return { key, url: `/test-media/${key}`, storage: "local" };
      },
    });

    expect(result.videoCodec).toBe("h264");
    expect(result.audioCodec).toBe("aac");
    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThanOrEqual(1280);
    expect(result.height).toBeGreaterThanOrEqual(720);
    expect(result.processedSizeBytes).toBeGreaterThan(0);
    expect(written.map(item => item.type)).toEqual(expect.arrayContaining(["video/mp4", "image/jpeg"]));
  }, 120_000);

  it("يرفض الفيديو الذي يتجاوز 10MB قبل المعالجة", () => {
    expect(() => validateVideoUpload(Buffer.alloc(MAX_VIDEO_BYTES + 1), "video/mp4")).toThrow("10 ميجابايت");
  });

  it("لا يكبّر المصدر الأصغر من 720p", async () => {
    const result = await processVideoUpload({ data: smallSourceVideo, fileName: "small.mp4", contentType: "video/mp4", storagePrefix: "tests/small" }, {
      put: async (key, data) => ({ key, url: `/test-media/${key}`, storage: "local" }),
    });
    expect(result.width).toBe(640);
    expect(result.height).toBe(360);
  }, 120_000);
});
