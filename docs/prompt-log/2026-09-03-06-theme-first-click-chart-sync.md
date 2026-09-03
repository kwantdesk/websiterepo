# Prompt

sometiems when i change the overall theme colour in settings, the charts dont change and stick to their old one until i press like 5 themes for it to work, this is an annoying bug, when someone presses a new theme, the whlelwesbtie its imiditely over written, it should not maintain its onyl colours, only exception is in an indicator or something has someone selected a custome theme that does not attach to chart colours

# Answer

Implemented and deployed an atomic first-click theme update. Settings now commits the chart palette and website CSS as one interaction, all mounted chart workspaces consume the exact event payload rather than re-reading stale storage, rapid selections derive from the latest committed palette, and explicitly custom-coloured indicators or surfaces remain opted out.

Verified with the new first-click regression suite, workspace theme precedence, account theme sync, indicator theme-follow coverage, TypeScript, scoped ESLint, and a production build.
