-- The restaurants layer of the trail map becomes a feature flag (task #110, spec 0035). It is on for everybody in
-- production today, so the flag starts on: nothing changes for visitors until it is switched.
insert into public.feature_flags (key, mode) values ('restaurants', 'on') on conflict (key) do nothing;
