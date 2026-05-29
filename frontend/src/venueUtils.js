export function buildBookableOptions(venue) {
  if (!venue) return [];

  const options = [];

  venue.areas?.forEach((area) => {
    area.nets?.forEach((net) => {
      options.push({
        id: net.id,
        label: `${area.name} — ${net.name}`,
        kind: 'net',
        areaName: area.name,
        hourlyRateLkr: net.hourlyRateLkr,
      });
    });
    if (area.fullArea) {
      options.push({
        id: area.fullArea.id,
        label: `${area.name} — Full area`,
        kind: 'full_area',
        areaName: area.name,
        hourlyRateLkr: area.fullArea.hourlyRateLkr,
      });
    }
  });

  venue.bays
    ?.filter((b) => !b.areaId)
    .forEach((space) => {
      options.push({
        id: space.id,
        label: space.name,
        kind: space.kind,
        areaName: null,
        hourlyRateLkr: space.hourlyRateLkr,
      });
    });

  return options;
}

export function isOwnVenue(user, venue) {
  return user?.role === 'owner' && venue?.ownerId === user?.id;
}
