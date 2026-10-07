// Kenya's 8 former provinces, used purely as a grouping level to narrow the
// County dropdown (Kenya's real administrative unit today is the 47 counties;
// provinces were abolished by the 2010 constitution but are still commonly
// used informally to group counties on forms like this one).

export interface KenyaRegion {
  name: string
  counties: string[]
}

export const KENYA_REGIONS: KenyaRegion[] = [
  {
    name: "Nairobi",
    counties: ["Nairobi"],
  },
  {
    name: "Central",
    counties: ["Kiambu", "Kirinyaga", "Murang'a", "Nyandarua", "Nyeri"],
  },
  {
    name: "Coast",
    counties: ["Kilifi", "Kwale", "Lamu", "Mombasa", "Taita-Taveta", "Tana River"],
  },
  {
    name: "Eastern",
    counties: ["Embu", "Isiolo", "Kitui", "Machakos", "Makueni", "Marsabit", "Meru", "Tharaka-Nithi"],
  },
  {
    name: "North Eastern",
    counties: ["Garissa", "Mandera", "Wajir"],
  },
  {
    name: "Nyanza",
    counties: ["Homa Bay", "Kisii", "Kisumu", "Migori", "Nyamira", "Siaya"],
  },
  {
    name: "Rift Valley",
    counties: [
      "Baringo",
      "Bomet",
      "Elgeyo-Marakwet",
      "Kajiado",
      "Kericho",
      "Laikipia",
      "Nakuru",
      "Nandi",
      "Narok",
      "Samburu",
      "Trans Nzoia",
      "Turkana",
      "Uasin Gishu",
      "West Pokot",
    ],
  },
  {
    name: "Western",
    counties: ["Bungoma", "Busia", "Kakamega", "Vihiga"],
  },
]

export const KENYA_COUNTIES: string[] = KENYA_REGIONS.flatMap((region) => region.counties).sort()

export function getCountiesForRegion(regionName: string): string[] {
  return KENYA_REGIONS.find((r) => r.name === regionName)?.counties ?? []
}

export const DEFAULT_COUNTRY = "Kenya"

// Kenya is the only country served, and the Region -> County cascade below
// hangs off it. Kept as a list so the field reads as a dropdown rather than a
// free-text box people can mistype.
export const COUNTRIES: string[] = [DEFAULT_COUNTRY]
