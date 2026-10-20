import { randomUUID } from "node:crypto";
import { encrypt, decrypt } from "./connections.mjs";

export function driveFileId(value) {
  const u = new URL(value);
  if (
    !["drive.google.com", "docs.google.com"].includes(u.hostname) ||
    u.protocol !== "https:"
  )
    throw new Error("Use a Google Drive file URL for media and thumbnails.");
  const id =
    /\/d\/([a-zA-Z0-9_-]+)/.exec(u.pathname)?.[1] || u.searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]{5,200}$/.test(id))
    throw new Error("Choose a specific Drive file, not a folder.");
  return id;
}
export function metadata(payload, accountId) {
  const v = payload.overrides[accountId];
  if (!v?.title?.trim() || v.title.length > 100)
    throw new Error(
      "Customize this YouTube account and enter a title of 1–100 characters.",
    );
  if (!v.audience)
    throw new Error("Choose whether this video is made for children.");
  if (v.privacy !== "public")
    throw new Error(
      "Scheduled YouTube publishing requires a public release. Set privacy to Public.",
    );
  if (v.coverMode === "frame")
    throw new Error(
      "Frame extraction is not implemented for YouTube. Use a Drive image thumbnail or the platform default.",
    );
  if (
    !payload.scheduledAt ||
    Date.parse(payload.scheduledAt) <= Date.now() + 300000
  )
    throw new Error(
      "Choose a publishing time at least five minutes in the future.",
    );
  const description = v.text;
  if (description.length > 5000)
    throw new Error("YouTube descriptions must be at most 5,000 characters.");
  return {
    snippet: {
      title: v.title,
      description,
      tags: v.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      categoryId: "22",
    },
    status: {
      privacyStatus: "private",
      publishAt: payload.scheduledAt,
      selfDeclaredMadeForKids: v.audience === "children",
      containsSyntheticMedia: v.aiDisclosure,
    },
  };
}
const at = () => new Date().toISOString();
function sessionUrl(value) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "www.googleapis.com" ||
    !u.pathname.startsWith("/upload/youtube/")
  )
    throw new Error("Unexpected YouTube upload destination.");
  return u.toString();
}
async function request(url, token, options = {}) {
  return fetch(url, {
    ...options,
    headers: { Authorization: "Bearer " + token, ...options.headers },
    redirect: "error",
    signal: AbortSignal.timeout(23000),
  });
}
async function body(response) {
  if (!response.ok)
    throw new Error(
      `Platform request failed (${response.status}). Check access, permissions, and quota.`,
    );
  return response.json();
}
function publicJob(job) {
  return {
    id: job.id,
    postId: job.post_id,
    accountId: job.account_id,
    phase: job.phase,
    bytesUploaded: Number(job.uploaded),
    totalBytes: Number(job.size),
    videoId: job.video_id || null,
    error: job.error || null,
    updatedAt: job.updated_at,
  };
}
export async function youtube(q, integrations) {
  await q(
    "CREATE TABLE IF NOT EXISTS youtube_jobs (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), post_id TEXT NOT NULL REFERENCES posts(id), account_id TEXT NOT NULL REFERENCES accounts(id), phase TEXT NOT NULL, session TEXT, size TEXT NOT NULL, uploaded TEXT NOT NULL, video_id TEXT, snapshot TEXT NOT NULL, error TEXT, lease_until TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(post_id,account_id))",
  );
  async function start(companyId, postId, accountId) {
    const p = (
      await q("SELECT * FROM posts WHERE id=$1 AND company_id=$2", [
        postId,
        companyId,
      ])
    )[0];
    const a = (
      await q("SELECT * FROM accounts WHERE id=$1 AND company_id=$2", [
        accountId,
        companyId,
      ])
    )[0];
    if (!p || !a || a.platform !== "youtube")
      throw new Error("YouTube destination not found in this company.");
    const payload = JSON.parse(p.payload);
    if (!payload.accountIds.includes(accountId))
      throw new Error("This account is not selected for the post.");
    const previous = (
      await q("SELECT * FROM youtube_jobs WHERE post_id=$1 AND account_id=$2", [
        postId,
        accountId,
      ])
    )[0];
    if (previous) return publicJob(previous);
    metadata(payload, accountId);
    const fileId = driveFileId(payload.mediaUrl);
    const { token } = await integrations.googleAccess(companyId, accountId);
    const file = await body(
      await request(
        "https://www.googleapis.com/drive/v3/files/" +
          fileId +
          "?fields=id,name,mimeType,size,version,capabilities(canDownload)",
        token,
      ),
    );
    if (
      !file.mimeType?.startsWith("video/") ||
      !file.capabilities?.canDownload ||
      !Number(file.size)
    )
      throw new Error(
        "The Drive source must be a downloadable video with a known size.",
      );
    const v = payload.overrides[accountId];
    if (v.coverMode === "image") {
      const cover = await body(
        await request(
          "https://www.googleapis.com/drive/v3/files/" +
            driveFileId(v.coverUrl) +
            "?fields=mimeType,size,capabilities(canDownload)",
          token,
        ),
      );
      if (
        !["image/jpeg", "image/png"].includes(cover.mimeType) ||
        !cover.capabilities?.canDownload ||
        Number(cover.size) > 2 * 1024 * 1024
      )
        throw new Error("Use a downloadable JPEG or PNG thumbnail under 2 MB.");
    }
    const job = {
      id: randomUUID(),
      company_id: companyId,
      post_id: postId,
      account_id: accountId,
      phase: "ready",
      size: String(file.size),
      uploaded: "0",
      snapshot: JSON.stringify({
        payload,
        fileId,
        version: file.version,
        mimeType: file.mimeType,
      }),
      updated_at: at(),
    };
    await q(
      "INSERT INTO youtube_jobs (id,company_id,post_id,account_id,phase,size,uploaded,snapshot,lease_until,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        job.id,
        companyId,
        postId,
        accountId,
        job.phase,
        job.size,
        job.uploaded,
        job.snapshot,
        at(),
        job.updated_at,
      ],
    );
    return publicJob(job);
  }
  async function step(companyId, id) {
    let job = (
      await q("SELECT * FROM youtube_jobs WHERE id=$1 AND company_id=$2", [
        id,
        companyId,
      ])
    )[0];
    if (!job) throw new Error("Upload job not found.");
    if (["scheduled", "needs_review"].includes(job.phase))
      return publicJob(job);
    const claimed = await q(
      "UPDATE youtube_jobs SET lease_until=$1 WHERE id=$2 AND company_id=$3 AND lease_until<=$4 RETURNING id",
      [new Date(Date.now() + 60000).toISOString(), id, companyId, at()],
    );
    if (!claimed.length)
      throw new Error(
        "This upload is being processed. Wait a minute and retry.",
      );
    const snapshot = JSON.parse(job.snapshot);
    const { payload, fileId, mimeType } = snapshot;
    try {
      const { token, externalId } = await integrations.googleAccess(
        companyId,
        job.account_id,
      );
      if (job.phase === "ready") {
        const video = metadata(payload, job.account_id);
        delete video.status.publishAt;
        const notify = payload.overrides[job.account_id].notifySubscribers;
        const response = await request(
          "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=" +
            String(notify),
          token,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Upload-Content-Type": mimeType,
              "X-Upload-Content-Length": job.size,
            },
            body: JSON.stringify(video),
          },
        );
        if (!response.ok) await body(response);
        const location = response.headers.get("location");
        if (!location)
          throw new Error("No resumable upload location was returned.");
        job.session = encrypt({ url: sessionUrl(location) });
        job.phase = "uploading";
      } else if (job.phase === "uploading") {
        const url = sessionUrl(decrypt(job.session).url);
        const progress = await request(url, token, {
          method: "PUT",
          headers: {
            "Content-Length": "0",
            "Content-Range": "bytes */" + job.size,
          },
        });
        if (progress.status === 200 || progress.status === 201) {
          const video = await progress.json();
          job.video_id = video.id;
          job.phase = "thumbnail";
        } else if (progress.status === 308) {
          const offset = progress.headers.get("range");
          const start = offset ? Number(/(\d+)$/.exec(offset)?.[1]) + 1 : 0;
          if (
            !Number.isSafeInteger(start) ||
            start < 0 ||
            start >= Number(job.size)
          )
            throw new Error("Upload progress needs manual verification.");
          const end = Math.min(start + 8 * 1024 * 1024, Number(job.size)) - 1;
          const current = await body(
            await request(
              "https://www.googleapis.com/drive/v3/files/" +
                fileId +
                "?fields=version,size",
              token,
            ),
          );
          if (
            current.version !== snapshot.version ||
            String(current.size) !== job.size
          ) {
            job.phase = "needs_review";
            throw new Error(
              "The source video changed after preparation. Inspect the upload before continuing.",
            );
          }
          const source = await request(
            "https://www.googleapis.com/drive/v3/files/" +
              fileId +
              "?alt=media",
            token,
            { headers: { Range: `bytes=${start}-${end}` } },
          );
          if (
            source.status !== 206 &&
            !(
              source.status === 200 &&
              start === 0 &&
              Number(job.size) <= 8 * 1024 * 1024
            )
          )
            throw new Error("Drive did not return the requested range.");
          const bytes = new Uint8Array(await source.arrayBuffer());
          if (bytes.length !== end - start + 1)
            throw new Error(
              "Source video changed or returned an incomplete range.",
            );
          const uploaded = await request(url, token, {
            method: "PUT",
            headers: {
              "Content-Type": mimeType,
              "Content-Length": String(bytes.length),
              "Content-Range": `bytes ${start}-${end}/${job.size}`,
            },
            body: bytes,
          });
          if (uploaded.status === 308) job.uploaded = String(end + 1);
          else if (uploaded.status === 200 || uploaded.status === 201) {
            const video = await uploaded.json();
            if (!video.id)
              throw new Error("Upload finished without a video ID.");
            job.video_id = video.id;
            job.uploaded = job.size;
            job.phase = "thumbnail";
          } else await body(uploaded);
        } else if (progress.status === 404 || progress.status === 410) {
          job.phase = "needs_review";
          job.error =
            "The upload session ended without a confirmed video ID. Check YouTube Studio before any new upload to avoid duplicates.";
        } else await body(progress);
      } else if (job.phase === "thumbnail") {
        const v = payload.overrides[job.account_id];
        if (v.coverMode === "image") {
          const image = await request(
            "https://www.googleapis.com/drive/v3/files/" +
              driveFileId(v.coverUrl) +
              "?alt=media",
            token,
          );
          if (!image.ok) throw new Error("Cannot download the thumbnail.");
          const bytes = new Uint8Array(await image.arrayBuffer());
          if (bytes.length > 2 * 1024 * 1024)
            throw new Error("Thumbnail is over the supported size.");
          await body(
            await request(
              "https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=" +
                encodeURIComponent(job.video_id),
              token,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    image.headers.get("content-type") ||
                    "application/octet-stream",
                },
                body: bytes,
              },
            ),
          );
        }
        job.phase = "schedule";
      } else if (job.phase === "schedule") {
        // Only schedule after the upload and requested thumbnail succeeded.
        const desired = metadata(payload, job.account_id);
        await body(
          await request(
            "https://www.googleapis.com/youtube/v3/videos?part=status",
            token,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: job.video_id,
                status: desired.status,
              }),
            },
          ),
        );
        job.phase = "verifying";
      } else if (job.phase === "verifying") {
        const info = await body(
          await request(
            "https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=" +
              encodeURIComponent(job.video_id),
            token,
          ),
        );
        const v = info.items?.[0];
        if (
          !v ||
          v.snippet.channelId !== externalId ||
          Date.parse(v.status.publishAt) !== Date.parse(payload.scheduledAt) ||
          v.status.privacyStatus !== "private"
        ) {
          job.phase = "needs_review";
          job.error =
            "YouTube did not confirm the requested channel and publication time. Inspect the video in YouTube Studio.";
        } else {
          job.phase = "scheduled";
          job.error = null;
        }
      }
      job.updated_at = at();
      await q(
        "UPDATE youtube_jobs SET phase=$1,session=$2,uploaded=$3,video_id=$4,error=$5,lease_until=$6,updated_at=$7 WHERE id=$8 AND company_id=$9",
        [
          job.phase,
          job.session || null,
          job.uploaded,
          job.video_id || null,
          job.error || null,
          at(),
          job.updated_at,
          id,
          companyId,
        ],
      );
      if (job.phase === "scheduled") {
        const jobs = await q(
          "SELECT account_id,phase FROM youtube_jobs WHERE post_id=$1 AND company_id=$2",
          [job.post_id, companyId],
        );
        if (
          payload.accountIds.every((a) =>
            jobs.some((j) => j.account_id === a && j.phase === "scheduled"),
          )
        )
          await q(
            "UPDATE posts SET status=$1,updated_at=$2 WHERE id=$3 AND company_id=$4",
            ["scheduled", at(), job.post_id, companyId],
          );
      }
      return publicJob(job);
    } catch (error) {
      await q(
        "UPDATE youtube_jobs SET phase=$1,error=$2,lease_until=$3,updated_at=$4 WHERE id=$5 AND company_id=$6",
        [job.phase, error.message, at(), at(), id, companyId],
      );
      throw error;
    }
  }
  async function list(companyId) {
    return (
      await q(
        "SELECT * FROM youtube_jobs WHERE company_id=$1 ORDER BY updated_at DESC",
        [companyId],
      )
    ).map(publicJob);
  }
  return { start, step, list };
}
