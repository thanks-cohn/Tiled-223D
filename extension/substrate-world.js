/* Tiled extension: Export a typed, agent-readable SUBSTRATE terrain-v1 map.
 * Install this file in the Tiled extensions directory and export as .sworld.json.
 * Tiled Qt JavaScript (not Node); no network requests and no image-model calls.
 */
(function () {
  var KNOWN = ["grass","dirt","sand","ocean","river","lake","tree"];
  function tileInfo(tile, layerName, x, y) {
    if (!tile) return null;
    var semantic = tile.property("semantic");
    if (typeof semantic !== "string" || KNOWN.indexOf(semantic) < 0)
      throw new Error("Unmapped tile at " + layerName + " (" + x + "," + y + "). Give its Tiled tile a known semantic property.");
    var kind = tile.property("kind");
    if (layerName === "Structures" && kind !== "structure") throw new Error("Only structure tiles belong on Structures.");
    if (layerName === "Ground" && kind === "structure") throw new Error("Structure tile on Ground at " + x + "," + y);
    return {id:layerName+":"+x+":"+y, x:x, z:y, semantic:semantic,
      kind:kind, material:tile.property("material"),
      walkable:tile.property("walkable") === true,
      liquid:tile.property("liquid") === true,
      waterBody:tile.property("waterBody") || null,
      asset3d:tile.property("asset3d"), tileLocalId:tile.id,
      flipped:false};
  }
  tiled.registerMapFormat("substrate-world", {
    name:"SUBSTRATE semantic world", extension:"sworld.json",
    write:function(map,fileName) {
      try {
        if (map.orientation !== TileMap.Orthogonal) return "Only orthogonal maps supported in terrain-v1.";
        if (map.infinite) return "Infinite maps are not supported in terrain-v1.";
        var out={schemaVersion:1, width:map.width,height:map.height,tilePixels:[map.tileWidth,map.tileHeight],
          metersPerTile:1,coordinateSystem:"XZ-plane, Y-up",
          layers:[],spawns:[],warnings:[]};
        for(var i=0;i<map.layerCount;i++) {
          var layer=map.layerAt(i);
          if(layer.isTileLayer) {
            var cells=[];
            for(var y=0;y<map.height;y++) for(var x=0;x<map.width;x++) {
              var tile=layer.tileAt(x,y);
              if(!tile) continue;
              var obj=tileInfo(tile,layer.name,x,y);
              var cell=layer.cellAt(x,y);
              if(cell.flippedHorizontally||cell.flippedVertically||cell.flippedAntiDiagonally)
                out.warnings.push(obj.id+" uses a flipped tile; renderer must apply Tiled flip flags.");
              obj.flipH=cell.flippedHorizontally;obj.flipV=cell.flippedVertically;obj.flipD=cell.flippedAntiDiagonally;
              cells.push(obj);
            }
            out.layers.push({name:layer.name,role:layer.property("role") || "unspecified",cells:cells});
          } else if(layer.isObjectLayer) {
            for(var o=0;o<layer.objectCount;o++) {
              var p=layer.objectAt(o);
              if(p.name==="LandingPoint") out.spawns.push({id:"spawn:"+p.id,kind:"landing",x:p.x/map.tileWidth,z:p.y/map.tileHeight});
            }
          }
        }
        if(!out.layers.some(function(l){return l.name==="Ground";})) return "Missing Ground tile layer.";
        var file=new TextFile(fileName,TextFile.WriteOnly);
        file.write(JSON.stringify(out,null,2));file.commit();
      } catch(e) { return "SUBSTRATE export failed: "+e; }
    }
  });
})();
