export type AdminLibraryRow = {
  status: string;
  publicId: string;
  quote: string;
  situation: string;
};

export type AdminContributionRow = { status: string };

export type AdminActivityRow = {
  action: string;
  actorName?: string | null;
  actorEmail?: string | null;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function filterAdminLibrary<T extends AdminLibraryRow>(items: T[], query: string, status: string) {
  const needle = normalize(query);
  return items.filter(item => (status === "all" || item.status === status) && (!needle || normalize(`${item.publicId} ${item.quote} ${item.situation}`).includes(needle)));
}

export function filterAdminContributions<T extends AdminContributionRow>(items: T[], status: string) {
  return items.filter(item => status === "all" || item.status === status);
}

export function filterAdminActivity<T extends AdminActivityRow>(items: T[], query: string) {
  const needle = normalize(query);
  return items.filter(item => !needle || normalize(`${item.action} ${item.actorName ?? ""} ${item.actorEmail ?? ""}`).includes(needle));
}
