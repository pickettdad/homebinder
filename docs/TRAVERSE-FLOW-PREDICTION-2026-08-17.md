# flow-v1 against a deliberate break — prediction recorded BEFORE looking at the data
Written 2026-08-17, before opening the owner's four JSON files.

`covered` = fraction of sampled pixels whose flow vector lands inside the frame bounds.

## 1 · Lens covered — I predict coverage reads HIGH, near 1.0. This is a FAILURE.
Optical flow on a featureless pair has nothing to track, and the documented behaviour of a
dense flow estimator with no gradient to follow is to return vectors near ZERO. Zero flow means
every sampled pixel stays where it is, and every pixel therefore lands inside the frame.

⚑ So the pair with the least evidence of contact reports the MOST coverage. That is the
blank-wall false negative — the exact defect #104's `impossiblyStill` guard was written for —
arriving one mechanism later, in the mechanism that replaced it.

Supporting evidence available before the fact: the owner reports the covered lens FIRED A LOT OF
CAPTURES. Frames fire on accumulated translation, so a covered lens producing many frames means
registration returns non-zero junk on featureless input rather than failing. It does not fail
loudly; it invents.

## 2 · Ninety-degree spin — I predict 0.4-0.7, NOT cleanly separated from a good pair.
Content is wholly different, so flow vectors are erratic rather than absent. Erratic vectors
still mostly land inside the frame, because "inside" is most of the plane. I expect overlap with
the 0.77-0.88 band of genuinely contiguous pairs, i.e. no usable threshold between them.

## 3 · Pause/resume across rooms — same as 2, for the same reason.

## Therefore
I predict flow-v1 does NOT reliably detect a genuine break, and that the covered-lens case fails
in the worst direction: reporting contiguous where the owner knows he broke contact.

If that is what the data shows, the finding stops everything above it and `covered` needs a
companion that measures whether the flow field is TRUSTWORTHY, not merely where it points —
the same three-valued honesty every previous mechanism needed, which flow-v1 currently lacks.
