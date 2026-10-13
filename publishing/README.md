# Publish for GitHub / Forge installation

**Canonical install manifest:** [https://raw.githubusercontent.com/pacts-and-polyhedrals/Altered-Carbon-ONI/main/module.json](https://raw.githubusercontent.com/pacts-and-polyhedrals/Altered-Carbon-ONI/main/module.json)

The source ZIP contains the complete repository at its root. Extract it and upload its files and folders to the root of [Altered-Carbon-ONI](https://github.com/pacts-and-polyhedrals/Altered-Carbon-ONI), replacing the previous version. Keep `module.json` beside `scripts`, `styles`, `templates`, and `README.md`. Upload the extracted contents, not the ZIP as a repository file. No separate batches or GitHub release are required.

The install ZIP contains one `altered-carbon-oni/` folder for manual installation. The manifest downloads GitHub's `main` archive by default. Keep the manifest URL visible near the top of the root README for every version.

Build both archives locally:

```sh
python3 publishing/build-release.py --repo pacts-and-polyhedrals/Altered-Carbon-ONI --source --output ./release
```

For an optional version-pinned GitHub release download:

```sh
python3 publishing/build-release.py --repo pacts-and-polyhedrals/Altered-Carbon-ONI --release-download --source --output ./release
```

Create tag `v1.2.0` and attach the generated `altered-carbon-oni-v1.2.0.zip` before updating the root manifest to that generated copy. The canonical manifest URL remains the raw `main/module.json` URL; only `download` changes to the versioned release asset. The README still explains the install manifest at the top.

The helper builds files without network access and does not publish to GitHub. For future updates, change the versions and documentation, run checks, build the archives and upload the complete matching source. A read-only GitHub connector cannot upload these changes.
