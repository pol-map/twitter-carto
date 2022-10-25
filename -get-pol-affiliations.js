import * as fs from "fs";

export function getPolAffiliations() {
  try {
    // Load affiliations file as string
    const polAffDataJson = fs.readFileSync('-political-affiliations.json', "utf8")

    try {
      const polAffData = JSON.parse(polAffDataJson)
      console.log('Political affiliations loaded and parsed');

      return polAffData
    } catch (error) {
      console.error("Error: the political affiliations file could not be parsed.", error)
    }
  } catch (error) {
    console.error("Error: the political affiliations file could not be loaded", error)
  }
}
