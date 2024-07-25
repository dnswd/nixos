{lib, ...}:
with builtins;
with lib; {
  filterMapAttrs = pred: f: attrs: filterAttrs pred (mapAttrs f attrs);
  filterMapAttrs' = pred: f: attrs: filterAttrs pred (mapAttrs' f attrs);

  mapFilterAttrs = f: pred: attrs: mapAttrs f (filter pred attrs);
  mapFilterAttrs' = f: pred: attrs: mapAttrs' f (filter pred attrs);
  
  mergeAttrs = let
    merge = v1: v2:
    if isList v1 && isList v2 then
      v1 ++ v2
    else if isAttrs v1 && isAttrs v2 then
      attrsets.mapAttrs (name: val: merge (v1.${name} or null) val) v2
    else
      v2;
  in merge;
}
