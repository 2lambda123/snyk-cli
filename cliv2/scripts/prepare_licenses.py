#!/usr/bin/env python3
import os
import re
from security import safe_requests

def manual_license_download(url, package_name):
    """    Download the license file from the given URL and save it to the specified package directory.

    Args:
        url (str): The URL of the license file to be downloaded.
        package_name (str): The name of the package for which the license is being downloaded.


    Raises:
        requests.exceptions.HTTPError: If an HTTP error occurs during the download process.
        OSError: If an OS level error occurs while creating directories or writing the license file.
    """

    folder_path = os.path.join(".", "internal", "embedded", "_data", "licenses", package_name)
    license_file_name = os.path.normpath(os.path.join(folder_path, "LICENSE"))

    if not os.path.exists(license_file_name):
        os.makedirs(folder_path, exist_ok=True)
        with safe_requests.get(url, stream=True, allow_redirects=True, timeout=60) as response:
            response.raise_for_status()
            with open(license_file_name, "wb") as license_file:
                for chunk in response.iter_content(chunk_size=8192):
                    license_file.write(chunk)

def main():
    # Try to find all licenses via the go.mod file
    go_bin_path = os.path.join(os.getcwd(), "_cache")
    os.environ["GOBIN"] = go_bin_path
    os.system("go install github.com/google/go-licenses@latest")
    os.environ["PATH"] += os.pathsep + go_bin_path
    os.system("go-licenses save ./... --save_path=./internal/embedded/_data/licenses --force --ignore github.com/snyk/cli/cliv2/")

    manual_license_download("https://raw.githubusercontent.com/davecgh/go-spew/master/LICENSE", "github.com/davecgh/go-spew")
    manual_license_download("https://raw.githubusercontent.com/alexbrainman/sspi/master/LICENSE", "github.com/alexbrainman/sspi")
    manual_license_download("https://raw.githubusercontent.com/pmezard/go-difflib/master/LICENSE", "github.com/pmezard/go-difflib")
    manual_license_download("https://go.dev/LICENSE?m=text", "go.dev")

    # Clean up and print result
    pattern = re.compile("COPYING|LICENSE|NOTICE.*", flags=re.IGNORECASE)
    for root, dirs, files in os.walk(os.path.join(".", "internal", "embedded", "_data", "licenses")):
        for entry in files:
            p = os.path.join(root, entry)
            if not pattern.match(entry):
                try:
                    if os.access(p, os.W_OK):
                        os.remove(p)
                except:
                    pass
            else:
                print(f"    {p}")

if __name__ == "__main__":
    main()
