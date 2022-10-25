import * as fs from "fs";

export function getLocale() {
  try {
    // Load affiliations file as string
    const localeDataJson = fs.readFileSync('locale.json', "utf8")

    try {
      const localeData = JSON.parse(localeDataJson)
      console.log('Locale loaded and parsed');

      return localeData
    } catch (error) {
      console.error("Error: the locale file could not be parsed.", error)
    }
  } catch (error) {
    console.error("Error: the locale file could not be loaded", error)
  }
}
