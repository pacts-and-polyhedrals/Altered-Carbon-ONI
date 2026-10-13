# Publish for GitHub / Forge installation

The source ZIP has files at the repository root. The install ZIP has one `altered-carbon-oni/` folder for manual installation. Neither archive is split into batches.

1. Create a GitHub repository, for example `altered-carbon-oni`, in your own account.
2. Extract the **source ZIP**, and upload the extracted files / folders to the repository root. `module.json` must be at the root, beside `scripts`, `styles` and `templates`.
3. Run the local release helper with your real repository name:

```sh
python3 publishing/build-release.py --repo YOUR-ACCOUNT/altered-carbon-oni --output ./release
```

4. Upload the helper's updated `module.json` back to the repository root before creating the release. Keep all other files in place.
5. Create a GitHub release with tag `v1.0.0`. Attach the helper's `module.json` and `altered-carbon-oni-v1.0.0.zip` as release assets.
6. Use the manifest URL written into that generated `module.json` for Foundry's **Install Module → Manifest URL**, or Forge's custom module installation.

The helper adds real release URLs to a copy of the manifest and includes that manifest in the archive. It does not connect to GitHub, create a repository, publish content or modify your system / adventure package.

For future updates, change both `module.json.version` and `package.json.version`, rerun tests and the release helper, then attach the matching assets to the matching release tag. Foundry's automatic updater needs a genuinely hosted manifest / download pair.
