# Prompt

sometimes the words ontop on the volume profiles glitch out and dissapear, some show, some dont, this needs fixing,m if someone has this turnoed on eg show the labels then they should show, not bug out and dissapear

# Answer

Fixed and deployed the volume-profile label renderer. Partly visible profiles keep their labels, labels are painted after every profile body and level, overlapping captions receive deterministic non-overlapping lanes, and VAH/POC/VAL names remain visible even when their extension line correctly stops at the next profile. The visible Labels setting now consistently governs the profile heading as well.

Verified with dedicated label regression coverage, profile docking, line occlusion, back-overhang, session-selection and session-toggle suites, TypeScript, ESLint, and a production build.
