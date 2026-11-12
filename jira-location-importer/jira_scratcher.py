#This python script fetches the content of the JIRA's kanvan board 'https://nordex-pm.atlassian.net/jira/software/c/projects/ECCM/boards/31?issueType=10022', looking only for the tasks IN COMMISSIONING.
#Of all the project names found (locations), the script cleans the names, delete duplicates and sorts them alphabetically.
#Finally, exports a .csv with all the locations ready to be imported into Wind-Checker-Tool (V:\ENG\Common\CWE\03_Tools\Wind Checker Tool).
#The wind checker tool will use a geocoder to extract the coordinates of the locations, that's why cleaning the names is important, because it improves the accuracy of the geocoder.

import urllib.request
import urllib.parse
import json
import base64
import re
import csv
import time
from pathlib import Path

#my atlassian account email and generated token to fetch JIRA
EMAIL = "alopezazorin@nordex-online.com"
API_TOKEN = "ATATT3xFfGF08bUK24d6In9pYz4a8kQfF7Ak2Y8OXG0PxuzPmyaAoBoi07MFeitS2gSjsFB8lZUE00unJ_A5FHS-G3o6-ndkd1jnyspsJwdJKtzUNXeHDAnAOve1Q24CcT8OWFkDfODkS-na8pPp6DW1-lr801HrAU0jlKFMnhsdHtts2E-KCsI=9989AC99"

PROJECT_NAME_FIELD = "customfield_10042" # placeholder for the "Project Name" column of a Jira tasks, which contains the location of the wind park
GCV_FIELD = "customfield_10066" # placeholder for the "GCV" (grid code version) column of a Jira task, which contains the country, e.g. "GCV 91 00 Germany VDE 4110 MS"

# Countries that can appear inside the GCV, with their ISO-3166-1 alpha-2 code (the format the Open-Meteo geocoder expects in its countryCode parameter)
# If a GCV with a new country appears, the script warns about it and the country must be added here
KNOWN_COUNTRIES = {
    "Argentina": "AR",
    "Australia": "AU",
    "Austria": "AT",
    "Belgium": "BE",
    "Bosnia": "BA", # the GCV says "Bosnia Herzegowina"
    "Brazil": "BR",
    "Canada": "CA",
    "Chile": "CL",
    "Colombia": "CO",
    "Croatia": "HR",
    "Denmark": "DK",
    "Ecuador": "EC",
    "Estonia": "EE",
    "Finland": "FI",
    "France": "FR",
    "Germany": "DE",
    "Great Britain": "GB", # not "UK"
    "Greece": "GR", # not "EL", which is the code the EU uses
    "India": "IN",
    "Ireland": "IE",
    "Italy": "IT",
    "Latvia": "LV",
    "Lithuania": "LT",
    "Mexico": "MX",
    "Montenegro": "ME",
    "Netherlands": "NL",
    "Norway": "NO",
    "Peru": "PE",
    "Poland": "PL",
    "Portugal": "PT",
    "Romania": "RO",
    "Serbia": "RS",
    "South Africa": "ZA",
    "Spain": "ES",
    "Sweden": "SE",
    "Turkey": "TR",
    "Ukraine": "UA",
    "United Kingdom": "GB", # not "UK"
    "United States": "US",
    "USA": "US", # e.g. "GCV 76 USA MISO 2016"
    "US": "US", # e.g. "GCV 110 00 US-CAISO"
    "Uruguay": "UY",
}

# Words that are never part of a place name: numbers written in German and "extension" in other languages
NON_PLACE_WORDS = [
    "eins", "zwei", "drei", "vier", "fuenf", "fünf",
    "ampliacion", "ampliación", "ampliamento", "ampliació", "ampliacao", "ampliação",
]

CSV_PATH = Path(__file__).parent / "jira_locations.csv" # the csv should always be in the same folder as this script


def jira_request(url): #this functions takes the JIRA url, fetches the data with AUTH headers and returns de response
    credentials = f"{EMAIL}:{API_TOKEN}"
    encoded_credentials = base64.b64encode(credentials.encode()).decode()

    headers = {
        "Authorization": f"Basic {encoded_credentials}",
        "Accept": "application/json"
    }

    request = urllib.request.Request(url, headers=headers) #fetches JIRA with correct url and header

    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def clean_name(location):
    #This function cleans the name of one location, so the name is ready for the geocoder
    cleaned = location

    # Remove text in parentheses, e.g. "Bliestorf (bei Lübeck)" -> "Bliestorf"
    cleaned = re.sub(r"\(.*?\)", " ", cleaned)
    # Replace separators
    cleaned = cleaned.replace("_", " ")
    cleaned = cleaned.replace("-", " ")
    # Remove numbers anywhere, also with a letter like 3a, 1A: "Atares 1 Extension" -> "Atares Extension", "Lindenberg 3a" -> "Lindenberg"
    # (not the numbers stuck to a letter before them, like the road "A16")
    cleaned = re.sub(r"(?<![A-Za-z\d])\d+[A-Za-z]?(?![A-Za-z])", " ", cleaned) # \d in the lookbehind, so it never starts in the middle of a number
    # Remove numbers stuck to the end of the name: "Skole2024" -> "Skole", "Weilerswist1A" -> "Weilerswist"
    cleaned = re.sub(r"(?<=[A-Za-z])\d+[A-Za-z]?$", "", cleaned)
    # Remove whole words that are never part of a place name: "Bedburg drei" -> "Bedburg", "Ampliación Figueruelas" -> "Figueruelas"
    cleaned = re.sub(rf"(?<!\w)({'|'.join(NON_PLACE_WORDS)})(?!\w)", " ", cleaned, flags=re.IGNORECASE)
    # Remove extra spaces
    cleaned = re.sub(r"\s+", " ", cleaned)

    # Remove initial and final spaces (trim). If nothing is left, keep the original name
    return cleaned.strip() or location.strip()


def country_from_gcv(gcv):
    #This function extracts the 2-letter country code from a raw GCV, e.g. "GCV 152 00 Canada - Nova Scotia (2022)" -> "CA". Returns "" if no known country is found
    for country, code in KNOWN_COUNTRIES.items():
        # (?<![A-Za-z]) and (?![A-Za-z]) instead of \b, because "_" counts as a letter for \b and "Australia_Macintyre" would not match
        if re.search(rf"(?<![A-Za-z]){re.escape(country)}(?![A-Za-z])", gcv, flags=re.IGNORECASE):
            return code
    return ""


def clean_locations(locations):
    #This function clean the names of the locations, so the names are ready for the geocoder
    cleaned_locations = []
    num_of_cleaned_locations = 0

    for location in locations:
        cleaned = clean_name(location)

        cleaned_locations.append(cleaned)

        if cleaned != location:
            num_of_cleaned_locations += 1

    cleaned_and_sorted_locations = sorted(cleaned_locations) # sort the locations again, just in case they are not sorted after the cleaning

    return cleaned_and_sorted_locations, num_of_cleaned_locations


def find_repeated_locations(locations):
    #This function groups the original project names by their cleaned name and returns only the ones that appear more than once
    #e.g. {"Beckum": ["Beckum", "Beckum_2"]}. It catches both names repeated in Jira and names that become equal after cleaning
    originals_by_cleaned_name = {}
    for location in locations:
        originals_by_cleaned_name.setdefault(clean_name(location), []).append(location)

    return {
        cleaned: originals
        for cleaned, originals in sorted(originals_by_cleaned_name.items())
        if len(originals) > 1
    }


def print_repeated_locations(repeated_locations):
    #This function prints which locations are repeated and the original project names they come from
    if not repeated_locations:
        print("\nThere are no repeated locations.\n")
        return

    print(f"\nThere are {len(repeated_locations)} repeated locations. We keep just one of each:")
    for cleaned, originals in repeated_locations.items():
        print(f"  {cleaned} ({len(originals)} times): {', '.join(originals)}")
    print()


def read_previous_locations():
    #This function reads the location names of the last export, before it gets overwritten. Returns None if there is no previous export
    if not CSV_PATH.exists():
        print("\nNo previous export was found.\n")
        return None

    try:
        with open(CSV_PATH, mode="r", newline="", encoding="utf-8-sig") as csv_file:
            reader = csv.DictReader(csv_file)
            if "name" not in (reader.fieldnames or []): # e.g. the csv was saved with Excel using ';' as separator
                print(f"\nWARNING: the last export has no 'name' column, so no comparison is shown (columns found: {reader.fieldnames}).")
                return None
            return {row["name"].strip() for row in reader if (row["name"] or "").strip()}
    except (OSError, UnicodeDecodeError) as e:
        print(f"\nWARNING: the last export could not be read, so no comparison is shown ({e}).")
        return None


def print_changes(previous_locations, current_locations):
    #This function compares the last export with the new one and prints what has changed
    if previous_locations is None:
        return

    current_locations = set(current_locations)
    added = sorted(current_locations - previous_locations)
    removed = sorted(previous_locations - current_locations)
    unchanged = len(current_locations & previous_locations)

    print("\n========== CHANGES SINCE THE LAST EXPORT ==========")
    if not added and not removed:
        print("No changes since the last .csv export.")
    else:
        print(f"{len(added)} new locations:")
        for location in added:
            print(f"  + {location}")
        print(f"{len(removed)} removed locations:")
        for location in removed:
            print(f"  - {location}")
    print(f"{unchanged} locations unchanged.")
    print("====================================================\n")


def export_csv(cleaned_locations, countries_by_location):
    with open(
        CSV_PATH,
        mode="w",
        newline="",
        encoding="utf-8"
    ) as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow([
            "name",
            "latitude",
            "longitude",
            "group",
            "country"
        ])

        for location in cleaned_locations:
            writer.writerow([
                location,
                "",
                "",
                "",
                " | ".join(sorted(country for country in countries_by_location.get(location, set()) if country)) # joined with " | " only if the repeated tasks of a location are in different countries
            ])
    print(
        f"CSV exported successfully with "
        f"{len(cleaned_locations)} locations."
    )


def main():
    try:
        print("\nConnecting to Jira...")
        print(
            "Looking into Kanban board: "
            "https://nordex-pm.atlassian.net/jira/software/c/projects/ECCM/boards/31?issueType=10022"
        )

        search_url = "https://nordex-pm.atlassian.net/rest/api/3/search/jql"
        params = {
          "jql": 'category in ("ECC Projekte", "P&OT Projects") AND project != Temp AND type = "PPC Commissioning" AND status = "In Commissioning"', #this filter was obtained from the kanvan board and then filtering type and status
          "maxResults": 100, # tasks per page. Jira may return fewer per page, so all the pages are read below
          "fields": f"{PROJECT_NAME_FIELD},{GCV_FIELD}"} # ask only for these fields, so each page returns them for every task (no extra call per task)

        # Jira returns the tasks in pages: each page says if it is the last one ("isLast") and, if not, how to ask for the next one ("nextPageToken")
        issues = []
        num_of_pages = 0
        while True:
            full_url = f"{search_url}?{urllib.parse.urlencode(params)}"
            data = jira_request(full_url)
            issues += data.get("issues", [])
            num_of_pages += 1

            next_page_token = data.get("nextPageToken")
            if data.get("isLast", True) or not next_page_token:
                break
            params["nextPageToken"] = next_page_token

        print(f"\nFound {len(issues)} tasks ({num_of_pages} page{'s' if num_of_pages > 1 else ''}).\n")

        project_names = []
        countries_by_location = {} # cleaned location name -> set of 2-letter country codes of its tasks
        unknown_gcvs = {} # raw GCV without a known country -> project names that have it
        for issue in issues:
            fields = issue.get("fields", {})

            project_name = fields.get(PROJECT_NAME_FIELD)
            gcv = fields.get(GCV_FIELD)
            gcv = gcv.get("value", "") if isinstance(gcv, dict) else (gcv or "") # GCV is a dropdown field: {"value": "GCV 91 00 Germany VDE 4110 MS", ...}

            if project_name:
                project_names.append(project_name)
                country = country_from_gcv(gcv)
                countries_by_location.setdefault(clean_name(project_name), set()).add(country)
                if not country:
                    unknown_gcvs.setdefault(gcv or "(empty GCV)", []).append(project_name)
                print(project_name)

        if unknown_gcvs:
            print("\nWARNING: the country of these GCVs is unknown, so their locations are exported without country. Add the country to KNOWN_COUNTRIES:")
            for gcv, names in sorted(unknown_gcvs.items()):
                print(f"  '{gcv}': {', '.join(names)}")

        all_sorted_locations = sorted(project_names)
        print(f"\nIn total, there are: {len(all_sorted_locations)} projects in the kanban board.\n")

        
        cleaned_and_sorted_locations, _ = clean_locations(all_sorted_locations)
        renamed_locations = [
            (location, clean_name(location))
            for location in sorted(set(all_sorted_locations)) # set() so a name repeated in Jira is counted and shown only once
            if clean_name(location) != location
        ]
        print(f"\n{len(renamed_locations)} locations have been cleaned.\n")
        for original, cleaned in renamed_locations:
            print(f"  '{original}' -> '{cleaned}'")

        cleaned_and_sorted_unique_locations = sorted(set(cleaned_and_sorted_locations)) # sorted() again because a set has no order
        repeated_locations = find_repeated_locations(all_sorted_locations)
        print_repeated_locations(repeated_locations)
        if repeated_locations:
            num_of_duplicates = sum(len(originals) - 1 for originals in repeated_locations.values()) # every repeated location keeps 1, the rest are duplicates
            print(f"By deleting those {num_of_duplicates} total duplicates, we will finally export {len(cleaned_and_sorted_unique_locations)} locations, instead of {len(all_sorted_locations)} initial locations.\n")
        print("This is the list of unique locations, the ones that are exported to the .csv:")
        for location in cleaned_and_sorted_unique_locations:
            print(f"  {location}")
            time.sleep(0.2)

        previous_locations = read_previous_locations() # call before export_csv() overwrites the file
        print_changes(previous_locations, cleaned_and_sorted_unique_locations)

        export_csv(cleaned_and_sorted_unique_locations, countries_by_location)

    except Exception as e:
        print("\nERROR")
        print(str(e))


if __name__ == "__main__":
    main()

