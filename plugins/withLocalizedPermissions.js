const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins")
const fs = require("fs")
const path = require("path")

function withLocalizedPermissions(config, translations) {
  // Step 1: Create .lproj directories and InfoPlist.strings files
  config = withDangerousMod(config, [
    "ios",
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot
      const projectName = cfg.modRequest.projectName

      for (const [locale, strings] of Object.entries(translations)) {
        const lprojDir = path.join(projectRoot, "ios", projectName, `${locale}.lproj`)
        fs.mkdirSync(lprojDir, { recursive: true })

        const content = Object.entries(strings)
          .map(([key, value]) => `"${key}" = "${value}";`)
          .join("\n")

        fs.writeFileSync(path.join(lprojDir, "InfoPlist.strings"), content, "utf-8")
      }

      return cfg
    },
  ])

  // Step 2: Add localization references to the Xcode project
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults
    const locales = Object.keys(translations)

    for (const locale of locales) {
      project.addKnownRegion(locale)
    }

    return cfg
  })

  return config
}

module.exports = withLocalizedPermissions
