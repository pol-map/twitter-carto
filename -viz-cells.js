import Graph from "graphology";
import gexf from "graphology-gexf";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"
import * as d3 from 'd3';
import dotenv from "dotenv";
import * as StackBlur from "stackblur-canvas";
import { getRenderer4K } from "./-get-renderer-4k.js";

dotenv.config();

export async function computeCellsOverlay(date, resources) {
  const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
  const year = targetDate.getFullYear()
  const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const thisFolder = `data/${year}/${month}/${datem}`

  // Read file
  var gexf_string;
  try {
      gexf_string = fs.readFileSync(thisFolder+'/network_spat.gexf', 'utf8');
      console.log('GEXF file loaded');
  } catch(e) {
      console.log('Error:', e.stack);
  }

  // Parse string
  var g = gexf.parse(Graph, gexf_string, {addMissingNodes: true});
  console.log('GEXF parsed');

  // RENDER
  let ns = getRenderer4K()

  ns.drawOverlayLayer = function(options) {
    ns.log("Draw overlay...")
    
    options = options || {}
    var g = ns.g
    var dim = ns.getRenderingPixelDimensions()
    var ctx = ns.createCanvas().getContext("2d")
    ns.scaleContext(ctx)

    // Paint nodes for contour masking
    let maskCtx = ns.createCanvas().getContext("2d")
    ns.scaleContext(maskCtx)
    ns.paintAll(maskCtx, "#000000")
    maskCtx.lineCap="round"
    maskCtx.lineJoin="round"
    const radius = ns.mm_to_px(8)
    g.nodes().forEach(nid => {
      var n = g.getNodeAttributes(nid)
      maskCtx.beginPath()
      maskCtx.arc(n.x, n.y, radius, 0, 2 * Math.PI, false)
      maskCtx.lineWidth = 0
      maskCtx.fillStyle = "#FFFFFF"
      maskCtx.shadowColor = 'transparent'
      maskCtx.fill()
    })
    StackBlur.canvasRGBA(
      maskCtx.canvas,
      0,
      0,
      maskCtx.canvas.width,
      maskCtx.canvas.height,
      100 // Blur radius
    );

    let rescale = function(xy) {
      ns.rescaler.forEach(f => {
        xy = f(xy)
      })
      return xy
    }

    // Paint quads resource by resource
    options.resources.forEach((res, i) => {
      let resCtx = ns.createCanvas().getContext("2d")
      ns.scaleContext(resCtx)
      ns.paintAll(resCtx, "#000000")
      resCtx.strokeStyle = "#FFFFFF"
      resCtx.lineWidth = 2;
      res.quads.forEach(quad => {
        // Paint quad
        let xy = rescale([quad.x, quad.y])
        let xy2 = rescale([quad.x+quad.w, quad.y+quad.w])
        resCtx.beginPath()
        resCtx.rect(xy[0], xy[1], xy2[0]-xy[0], xy2[1]-xy[1])
        resCtx.fillStyle = "#FFFFFF"
        resCtx.fill()
        resCtx.stroke()
        resCtx.closePath()
      })

      // Mask
      resCtx.globalCompositeOperation = "multiply"
      resCtx.drawImage(maskCtx.canvas, 0, 0)
      resCtx.globalCompositeOperation = "source-over"

      // Blur res canvas a bit
      StackBlur.canvasRGBA(
        resCtx.canvas,
        0,
        0,
        resCtx.canvas.width,
        resCtx.canvas.height,
        24 // Blur radius
      );

      var imgd = resCtx.getImageData(0, 0, resCtx.canvas.width, resCtx.canvas.height)

      // Find contour
      var values = imgd.data.filter(function(d,i){ return i%4==1 })
      var contour = d3.contours()
        .size([resCtx.canvas.width, resCtx.canvas.height])
        .thresholds(d3.range(0, 255))
        .contour(values, Math.round(255*0.9));

      // // Draw contour
      ctx.globalAlpha = 0.666;
      const path = d3.geoPath(null, ctx)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.lineWidth = 0
      ctx.beginPath()
      path(contour)
      ctx.fillStyle = "#FFFFFF"
      ctx.fill()

      // Reset
      ctx.globalAlpha = 1;

      // The contour is a multipolygon (disjoint)
      // We draw each part separately
      contour.coordinates.forEach(points => {

        // Find the polygon's fallback centroid
        let polygonHull = d3.polygonHull(points[0])
        let centroid = d3.polygonCentroid(polygonHull)

        // Draw polygon into invisible canvas to find the better centroid
        let polygon = {type:"MultiPolygon", value:230, coordinates:[points]}
        let polyCtx = ns.createCanvas().getContext("2d")
        ns.paintAll(polyCtx, "#000000")
        polyCtx.lineCap = "round"
        polyCtx.lineJoin = "round"
        polyCtx.fillStyle = "#FFFFFF"
        polyCtx.lineWidth = 0
        let path = d3.geoPath(null, polyCtx)
        polyCtx.beginPath()
        path(polygon)
        polyCtx.fill()
        polyCtx.closePath()

        // In short, it will shrink the polygon to help having the label
        // not on its edge, but more in the middle. (see below)
        StackBlur.canvasRGBA(
          polyCtx.canvas,
          0,
          0,
          polyCtx.canvas.width,
          polyCtx.canvas.height,
          64 // Blur radius
        );
  
        // To test whether a polygon contains a point, we actually look whether the
        // pixel is white in the canvas where we drew that polygon
        function polygonContains(point) {
          const pixel = polyCtx.getImageData(point[0], point[1], 1, 1).data;
          return pixel[0] == 255 // Just check the Red channel
        }

        // Fix edge case: centroid outside of the polygon.
        // This happens when polygons have hollow parts, which is not that rare.
        if (!polygonContains(centroid)) {
          /// Strategy: sample space with a grid, test which points
          /// are conatined by the polygon, and pick the closest one.
          let d2Centroid = Infinity
          let newCentroid
          const gridStep = 33
          for (let x=0; x<=resCtx.canvas.width; x += gridStep) {
            for (let y=0; y<=resCtx.canvas.height; y += gridStep) {
              const point = [x,y]
              const d2 = Math.pow(x-centroid[0], 2) + Math.pow(y-centroid[1], 2)
              const isIn = polygonContains(point)
              if (d2<d2Centroid && isIn) {
                d2Centroid = d2
                newCentroid = point
              }
            }
          }
          centroid = newCentroid || centroid
        }
        
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        drawText(ctx, alphabet[i], centroid[0], centroid[1]+42, "center", "#303040", 0, "bold 120px Raleway")          
      })

    })


    ns.report("...done.")
    return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)

    function drawText(ctx, txt, x, y, textAlign, text_color, text_border_thickness, font) {
      ctx.textAlign = textAlign || "start";
      ctx.font = font
      if (text_border_thickness > 0) {
        ctx.lineWidth = text_border_thickness;
        ctx.fillStyle = text_color;
        ctx.strokeStyle = text_color;
        ctx.fillText(
          txt,
          x,
          y
        );
        ctx.strokeText(
          txt,
          x,
          y
        );
      } else {
        ctx.lineWidth = 0;
        ctx.fillStyle = text_color;
        ctx.fillText(
          txt,
          x,
          y
        );
      }
    }
  }

  let r = await ns.renderAndGetImgd(g, {resources}) // Custom
  return new Promise((resolve, reject) => {
    resolve(r)
  });
}
