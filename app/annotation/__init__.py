"""Annotation lane: checkable pointers to authenticated referents, never verdicts.

The lane runs a ground-truth cross-reference pass with the existing vision
models and emits structured pointers for a HUMAN to verify against a named
referent. It sits entirely outside the scored aggregation (app/aggregate.py
never imports this package), adds no outbound host beyond the three keyed
vendor endpoints the scored pass already uses, and never fetches a referent.
"""
