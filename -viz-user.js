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
      if (dayEdgeIndex[e.Source+"|"+e.Target]) {
        g.setEdgeAttribute(key, "daily", true)
        g.setNodeAttribute(e.Source, "daily", true)
        g.setNodeAttribute(e.Target, "daily", true)
      }
    }
  })
  console.log('Edges integrated');

  // Do not draw unnecessary nodes
  g.nodes().forEach(nid => {
    g.setNodeAttribute(nid, "draw", g.degree(nid)>0 || nid==userId)
  })

  // RENDER
  let ns = getRenderer4K()

  ns.drawOverlayLayer = function(options) {
    ns.log("Draw overlay...")
    
    options = options || {}
    options.node_size = options.node_size || 1
    options.edge_thickness = 0.2
    options.colorEgoNode     = "#FFFFFF"
    var g = ns.g
    var dim = ns.getRenderingPixelDimensions()
    var ctx = ns.createCanvas().getContext("2d")
    ns.scaleContext(ctx)
    let thickness

    ctx.lineCap="round"
    ctx.lineJoin="round"

    ctx.globalAlpha = 0.5;
    
    // Paint all nodes
    g.nodes()
    .filter(nid => g.getNodeAttribute(nid, "draw"))
    .forEach(nid => {
      var n = g.getNodeAttributes(nid)
      let radius = ns.mm_to_px(0.2) + options.node_size * n.size

      let color = d3.color(n.color)
      // Tune the color
      let hsl = d3.hsl(color)
      // hsl.s = Math.min(1, hsl.s * 1.2)
      hsl.l = Math.min(1, 1.1*hsl.l)
      color = d3.color(hsl)

      ctx.beginPath()
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI, false)
      ctx.lineWidth = 0
      ctx.fillStyle = color.toString()
      ctx.shadowColor = 'transparent'
      ctx.fill()
    })

    // Paint all in edges
    thickness = ns.mm_to_px(options.edge_thickness)
    g.edges().forEach(eid => {
      if (g.target(eid) == userId) {
        const n_s = g.getNodeAttributes(g.source(eid))
        const n_t = g.getNodeAttributes(g.target(eid))

        let color = d3.color(n_s.color)
        // Tune the color
        let hsl = d3.hsl(color)
        // hsl.s = Math.min(1, hsl.s * 1.2)
        hsl.l = Math.min(1, 1.1*hsl.l)
        color = d3.color(hsl)

        let e = g.getEdgeAttributes(eid)
        ctx.lineWidth = thickness
        ctx.beginPath()
        ctx.strokeStyle = color.toString()
        ctx.moveTo(n_s.x, n_s.y)
        ctx.lineTo(n_t.x, n_t.y)
        ctx.stroke()
        ctx.closePath()
      }
    })

    // Paint all out edges
    thickness = ns.mm_to_px(options.edge_thickness)
    g.edges().forEach(eid => {
      if (g.source(eid) == userId) {
        const n_s = g.getNodeAttributes(g.source(eid))
        const n_t = g.getNodeAttributes(g.target(eid))
        let e = g.getEdgeAttributes(eid)
        ctx.lineWidth = thickness
        ctx.beginPath()
        ctx.strokeStyle = options.colorAllEdgesOut
        ctx.moveTo(n_s.x, n_s.y)
        ctx.lineTo(n_t.x, n_t.y)
        ctx.stroke()
        ctx.closePath()
      }
    })

    ctx.globalAlpha = 0.8;

    // Paint daily nodes
    g.nodes()
    .filter(nid => g.getNodeAttribute(nid, "draw") && g.getNodeAttribute(nid, "daily") )
    .forEach(nid => {
      var n = g.getNodeAttributes(nid)
      let radius = ns.mm_to_px(0.5) + options.node_size * n.size
      ctx.beginPath()
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI, false)
      ctx.lineWidth = 0
      ctx.fillStyle = "#DDDDDD"
      ctx.shadowColor = 'transparent'
      ctx.fill()
    })

    // Paint daily in edges
    thickness = ns.mm_to_px(options.edge_thickness + 0.1)
    g.edges().forEach(eid => {
      if (g.getEdgeAttribute(eid, "daily") && g.target(eid) == userId) {
        const n_s = g.getNodeAttributes(g.source(eid))
        const n_t = g.getNodeAttributes(g.target(eid))
        let e = g.getEdgeAttributes(eid)
        ctx.lineWidth = thickness
        ctx.beginPath()
        ctx.strokeStyle = "#DDDDDD"
        ctx.moveTo(n_s.x, n_s.y)
        ctx.lineTo(n_t.x, n_t.y)
        ctx.stroke()
        ctx.closePath()
      }
    })

    // Paint daily out edges
    thickness = ns.mm_to_px(options.edge_thickness + 0.1)
    g.edges().forEach(eid => {
      if (g.getEdgeAttribute(eid, "daily") && g.source(eid) == userId) {
        const n_s = g.getNodeAttributes(g.source(eid))
        const n_t = g.getNodeAttributes(g.target(eid))
        let e = g.getEdgeAttributes(eid)
        ctx.lineWidth = thickness
        ctx.beginPath()
        ctx.strokeStyle = "#FFFFFF"
        ctx.moveTo(n_s.x, n_s.y)
        ctx.lineTo(n_t.x, n_t.y)
        ctx.stroke()
        ctx.closePath()
      }
    })

    ctx.globalAlpha = 1;

    // Paint EGO
    ;[userId].forEach(nid => {
      if (g.hasNode(nid)) {
        let n = g.getNodeAttributes(nid)
        let radius = ns.mm_to_px(2) + options.node_size * n.size
        ctx.beginPath()
        ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI, false)
        ctx.lineWidth = 0
        ctx.fillStyle = options.colorEgoNode
        ctx.shadowColor = 'transparent'
        ctx.fill()
      }
    })

    ns.report("...done.")
    return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  }

  let r = await ns.renderAndGetImgd(g, {userId, allEdges, dayEdges}) // Custom
  return new Promise((resolve, reject) => {
    resolve(r)
  });
}
