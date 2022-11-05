import Graph from "graphology";
import gexf from "graphology-gexf";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"
import * as d3 from 'd3';
import dotenv from "dotenv";
import { getRenderer4K } from "./-get-renderer-4k.js";

dotenv.config();

export async function computeUserViz(date, userId, allEdges, dayEdges) {
  const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
  const year = targetDate.getFullYear()
  const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const thisFolder = `data/${year}/${month}/${datem}`

  // Read file
  var gexf_string, edges_string;
  try {
      gexf_string = fs.readFileSync(thisFolder+'/network_spat.gexf', 'utf8');
      console.log('GEXF file loaded');
  } catch(e) {
      console.log('Error:', e.stack);
  }

  // Parse string
  var g = gexf.parse(Graph, gexf_string, {addMissingNodes: true});
  console.log('GEXF parsed');

  // Index dayEdges
  let dayEdgeIndex = {}
  dayEdges.forEach(de => {
    dayEdgeIndex[de.Source+"|"+de.Target] = de
  })

  // Add edges (if both ends in map)
  allEdges.forEach(e => {
    if (g.hasNode(e.Source) && g.hasNode(e.Target)) {
      const [key, edgeWasAdded, sourceWasAdded, targetWasAdded] = g.mergeEdge(e.Source, e.Target)
      g.setEdgeAttribute(key, "daily", !!dayEdgeIndex[e.Source+"|"+e.Target])
    }
  })
  console.log('Edges integrated');

  console.log("g.order", g.order, "g.size", g.size)

  // RENDER
  let ns = getRenderer4K()

  ns.drawOverlayLayer = function(options) {
    ns.log("Draw overlay...")
    
    options = options || {}
    var g = ns.g
    var dim = ns.getRenderingPixelDimensions()
    var ctx = ns.createCanvas().getContext("2d")
    ns.scaleContext(ctx)

    // Paint nodes
    ctx.globalAlpha = 0.666;
    // ns.paintAll(ctx, "#FF0000")
    ctx.lineCap="round"
    ctx.lineJoin="round"
    const radius = ns.mm_to_px(0.2)
    g.nodes().forEach(nid => {
      var n = g.getNodeAttributes(nid)
      ctx.beginPath()
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI, false)
      ctx.lineWidth = 0
      ctx.fillStyle = "#FFFFFF"
      ctx.shadowColor = 'transparent'
      ctx.fill()
    })

    ns.report("...done.")
    return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  let r = await ns.renderAndGetImgd(g, {userId, allEdges, dayEdges}) // Custom
  return new Promise((resolve, reject) => {
    resolve(r)
  });
}
