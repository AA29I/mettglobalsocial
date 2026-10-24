import { networks, type Account, type Payload } from "./types";

export type NetworkValidationItem = {
  accountId: string;
  accountName: string;
  platform: string;
  networkLabel: string;
  format: string;
  errors: string[];
};

export type ComposerValidationResult = {
  generalErrors: string[];
  networkItems: NetworkValidationItem[];
  totalErrors: number;
  canSchedule: boolean;
};

/**
 * Evaluates live Metricool-style per-network requirements for a composer draft:
 * - Reel, Short and TikTok require a video
 * - Instagram requires at least one image or video
 * - Pinterest requires media plus a board
 * - Post text must not be empty
 */
export function validateComposerDraft(
  payload: Payload,
  accounts: Account[],
): ComposerValidationResult {
  const destinationMap = new Map(
    accounts.filter((a) => a.platform !== "drive").map((a) => [a.id, a]),
  );
  const selectedAccounts = payload.accountIds
    .map((id) => destinationMap.get(id))
    .filter((a): a is Account => Boolean(a));

  const generalErrors: string[] = [];
  if (selectedAccounts.length === 0) {
    generalErrors.push("Select at least one destination account.");
    if (!payload.text.trim()) {
      generalErrors.push("Post text must not be empty.");
    }
  }

  const hasMedia = Boolean(payload.mediaUrl.trim());
  const isVideo = hasMedia && payload.mediaKind === "video";

  const networkItems: NetworkValidationItem[] = selectedAccounts.map(
    (account) => {
      const override = payload.overrides[account.id];
      const defaultFormat = networks[account.platform]?.formats[0] || "post";
      const format = (override?.format || defaultFormat).toLowerCase();
      const effectiveText = (override ? override.text : payload.text).trim();
      const board = (override?.board || "").trim();
      const errors: string[] = [];

      if (!effectiveText) {
        errors.push("Post text must not be empty.");
      }

      if (account.platform === "instagram" && !hasMedia) {
        errors.push("Instagram requires at least one image or video.");
      }

      if (format === "reel" && !isVideo) {
        errors.push("Reel requires a video.");
      }

      if (format === "short" && !isVideo) {
        errors.push("Short requires a video.");
      }

      if (account.platform === "tiktok" && !isVideo) {
        errors.push("TikTok requires a video.");
      }

      if (account.platform === "pinterest") {
        if (!hasMedia) {
          errors.push("Pinterest requires media (an image or video).");
        }
        if (!board) {
          errors.push("Pinterest requires a board.");
        }
      }

      return {
        accountId: account.id,
        accountName: account.name,
        platform: account.platform,
        networkLabel: networks[account.platform]?.label || account.platform,
        format,
        errors,
      };
    },
  );

  const networkErrorCount = networkItems.reduce(
    (sum, item) => sum + item.errors.length,
    0,
  );
  const totalErrors = generalErrors.length + networkErrorCount;

  return {
    generalErrors,
    networkItems,
    totalErrors,
    canSchedule: selectedAccounts.length > 0 && totalErrors === 0,
  };
}
