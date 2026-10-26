# Quiet GEX flow chart badge

User reported the unwanted “hollow push — trap watch” message.

Removed the automatic price-positioned sponsorship verdict badge and its
coordinate calculation from the shared Chart component. This removes both
hollow/sponsored floating messages across chart instances. The underlying flow
feed, calculations and manually expanded flow detail strip remain unchanged.

Validation: all seven existing gexbot-flow tests pass. Production build checked
before release. No gateway restart, provider requests or new background polling.
