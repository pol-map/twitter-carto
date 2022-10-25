import Graph from "graphology";
import gexf from "graphology-gexf";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"
import * as d3 from 'd3';
import dotenv from "dotenv";
import * as StackBlur from "stackblur-canvas";

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

  var settings = {}

  // Orientation & layout:
  settings.flip_x = false
  settings.flip_y = true
  settings.rotate = 0 // In degrees, clockwise
  settings.margin_top    =  2 // in mm
  settings.margin_right  = 12 // in mm
  settings.margin_bottom = 12 // in mm
  settings.margin_left   =  2 // in mm

  // Image size and resolution
  settings.image_width = 304 // in mm. Default: 200mm (fits in a A4 page)
  settings.image_height = 171
  settings.output_dpi = 320.842 // Dots per inch.
  settings.rendering_dpi = 320.842 // Default: same as output_dpi. You can over- or under-render to tweak quality and speed.

  /// RENDERER
  let newRenderer = function(){

    // NAMESPACE
    var ns = {}

    // Activate when using Node.js
    ns._nodejs = true

    /// Define renderer
    ns.render = function(g, settings) {
      
      ns.init(g, settings)

      const overlayImage = ns.drawOverlayLayer(ns.settings, resources)
      
      // Build final canvas
      var renderingCanvas = ns.createCanvas()
      renderingCanvas.getContext("2d").putImageData(overlayImage, 0, 0)
      if (ns.settings.output_dpi == ns.settings.rendering_dpi) {
        return renderingCanvas
      }
      var canvas = ns.createCanvas()
      let outputWidth = Math.floor(ns.settings.image_width * ns.settings.output_dpi * 0.0393701 / ns.settings.tile_factor)
      let outputHeight = Math.floor(ns.settings.image_height * ns.settings.output_dpi * 0.0393701 / ns.settings.tile_factor)
      canvas.width = outputWidth
      canvas.height = outputHeight
      let ctx = canvas.getContext("2d")
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(renderingCanvas, 0, 0, outputWidth, outputHeight);
      return canvas
    }

    // Render and return image data
    ns.renderAndGetImgd = async function(g, settings) {
      return new Promise(resolve => {
        let canvas = ns.render(g, settings)
        resolve(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height))
      })
    }

    /// Initialization
    ns.init = function(g, settings) {
      if (ns._initialized) { return }

      ns.report("Initialization")

      settings.tile_factor = 1 // Integer, default 1. Number of rows and columns of the grid of exported images.
      settings.tile_to_render = [0, 0] // Grid coordinates, as integers
      ns.settings = settings
      ns.g = g.copy()

      // Fix missing coordinates and/or colors:
      //  some parts of the script require default values
      //  that are sometimes missing. We add them for consistency.)
      ns.addMissingVisualizationData()

      // For commodity, rescale the network to canvas-related coordinates
      ns.rescaleGraphToGraphicSpace(ns.settings)

      ns._initialized = true
    }




    /// FUNCTIONS

    ns.drawOverlayLayer = function(options, resources) {
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
      resources.forEach((res, i) => {
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
          
          drawText(ctx, i+1, centroid[0], centroid[1]+30, "center", "#303040", 0, "bold 120px Raleway")          
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

    ns.truncateWithEllipsis = function(string, n) {
      if (n && n<Infinity) return string.substr(0,n-1)+(string.length>n?'…':'');
      return string
    }

    ns.paintAll = function(ctx, color) {
      ctx.beginPath()
      ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.fillStyle = color
      ctx.fill()
      ctx.closePath()
    }

    ns.createCanvas = function() {
      let dim = ns.getRenderingPixelDimensions()
      let canvas
      if (ns._nodejs) {
        canvas = createCanvas(dim.w, dim.h) // Node version
      } else {
        canvas = document.createElement('canvas')
      }
      canvas.width = dim.w
      canvas.height = dim.h
      return canvas
    }

    ns.scaleContext = function(ctx) {
      ctx.scale(ns.settings.tile_factor, ns.settings.tile_factor)
      ctx.translate(
        -ctx.canvas.width *ns.settings.tile_to_render[0]/ns.settings.tile_factor,
        -ctx.canvas.height*ns.settings.tile_to_render[1]/ns.settings.tile_factor
      )
    }

    ns.getRenderingPixelDimensions = function() {
      let width = Math.floor(ns.mm_to_px(ns.settings.image_width))
      let height = Math.floor(ns.mm_to_px(ns.settings.image_height))
      return {w:width, h:height}
    }

    ns.addMissingVisualizationData = function() {
      ns.log("Add missing visualization data...")
      var colorIssues = 0
      var coordinateIssues = 0
      var g = ns.g
      g.nodes().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        if (!isNumeric(n.x) || !isNumeric(n.y)) {
          var c = getRandomCoordinates()
          n.x = c[0]
          n.y = c[1]
          coordinateIssues++
        }
        if (!isNumeric(n.size)) {
          n.size = 1
        }
        if (n.color == undefined) {
          n.color = '#665'
          colorIssues++
        }
        if (n.label == undefined) {
          n.label = ''
        }
      })

      if (coordinateIssues > 0) {
        console.log('Note: '+coordinateIssues+' nodes had coordinate issues. We carelessly fixed them.')
      }

      function isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n)
      }
      
      function getRandomCoordinates() {
        var candidates
        var d2 = Infinity
        while (d2 > 1) {
          candidates = [2 * Math.random() - 1, 2 * Math.random() - 1]
          d2 = candidates[0] * candidates[0] + candidates[1] * candidates[1]
        }
        var heuristicRatio = 5 * Math.sqrt(g.order)
        return candidates.map(function(d){return d * heuristicRatio})
      }
      ns.report("...done.")
    }

    ns.rescaleGraphToGraphicSpace = function(options) {
      ns.log("Rescale graph to graphic space...")
      options = options || {}
      options.flip_x = options.flip_x || false
      options.flip_y = options.flip_y || false
      options.rotate = options.rotate || 0
      options.use_barycenter_ratio = options.use_barycenter_ratio || .2 // Between 0 (center for borders) and 1 (center for mass)
      options.contain_in_inscribed_circle = options.contain_in_inscribed_circle || false
      options.margin_bottom = (options.margin_bottom === undefined)?( 6):(options.margin_bottom) // in mm, space for the text etc.
      options.margin_right  = (options.margin_right  === undefined)?( 6):(options.margin_right ) // in mm, space for the text etc.
      options.margin_left   = (options.margin_left   === undefined)?( 6):(options.margin_left  ) // in mm, space for the text etc.
      options.margin_top    = (options.margin_top    === undefined)?( 6):(options.margin_top   ) // in mm, space for the text etc.

      var g = ns.g
      let dim = ns.getRenderingPixelDimensions()
      let m = {
        t: ns.mm_to_px(options.margin_top),
        r: ns.mm_to_px(options.margin_right),
        b: ns.mm_to_px(options.margin_bottom),
        l: ns.mm_to_px(options.margin_left)
      }

      ns.rescaler = []

      // Flip
      if (options.flip_x) {
        ns.rescaler.push(xy => [-xy[0], xy[1]])
        g.nodes().forEach(function(nid){
          var n = g.getNodeAttributes(nid)
          n.x = -n.x
        })
      }
      if (options.flip_y) {
        ns.rescaler.push(xy => [xy[0], -xy[1]])
        g.nodes().forEach(function(nid){
          var n = g.getNodeAttributes(nid)
          n.y = -n.y
        })
      }

      // Rotate
      function cartesian2Polar(x, y){
        let dist = Math.sqrt(x*x + y*y)
        let radians = Math.atan2(y,x) //This takes y first
        let polarCoor = { dist:dist, radians:radians }
        return polarCoor
      }
      if (options.rotate != 0) {
        let theta = Math.PI * options.rotate / 180
        g.nodes().forEach(function(nid){
          var n = g.getNodeAttributes(nid)
          let pol = cartesian2Polar(n.x,n.y)
          let d = pol.dist
          let angle = pol.radians + theta
          n.x = d * Math.cos(angle)
          n.y = d * Math.sin(angle)
        })
        ns.rescaler.push(xy => {
          let pol = cartesian2Polar(xy[0], xy[1])
          let d = pol.dist
          let angle = pol.radians + theta
          let x = d * Math.cos(angle)
          let y = d * Math.sin(angle)
          return [x, y]
        })
      }

      var ratio
      var xcenter
      var ycenter

      // Barycenter resize
      var xbarycenter = 0
      var ybarycenter = 0
      var wtotal = 0
      var dx
      var dy

      g.nodes().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        // We use node size as weight (default to 1)
        n.size = n.size || 1
        xbarycenter += n.size * n.x
        ybarycenter += n.size * n.y
        wtotal += n.size
      })
      xbarycenter /= wtotal
      ybarycenter /= wtotal

      // Geometric center
      let xext = d3.extent(g.nodes(), nid => g.getNodeAttribute(nid, 'x'))
      let yext = d3.extent(g.nodes(), nid => g.getNodeAttribute(nid, 'y'))
      var xgeocenter = (xext[0] + xext[1]) / 2
      var ygeocenter = (yext[0] + yext[1]) / 2

      // Compromise
      xcenter = options.use_barycenter_ratio * xbarycenter + (1-options.use_barycenter_ratio) * xgeocenter
      ycenter = options.use_barycenter_ratio * ybarycenter + (1-options.use_barycenter_ratio) * ygeocenter

      if (options.contain_in_inscribed_circle) {
        var dmax = 0 // Maximal distance from center
        g.nodes().forEach(function(nid){
          var n = g.getNodeAttributes(nid)
          var d = Math.sqrt( Math.pow(n.x - xcenter - n.size, 2) + Math.pow(n.y - ycenter - n.size, 2) )
          dmax = Math.max(dmax, d)
        })

        ratio = ( Math.min(dim.w-m.r-m.l, dim.h-m.t-m.b) ) / (2 * dmax)
        console.log("Rescale ratio: "+ratio)
      } else {
        var dxmax = 0
        var dymax = 0
        g.nodes().forEach(function(nid){
          var n = g.getNodeAttributes(nid)
          var dx = Math.abs(n.x - xcenter - n.size)
          var dy = Math.abs(n.y - ycenter - n.size)
          dxmax = Math.max(dxmax, dx)
          dymax = Math.max(dymax, dy)
        })
        ratio = Math.min((dim.w-m.r-m.l)/(2 * dxmax), (dim.h-m.t-m.b)/(2 * dymax))
        console.log("Rescale ratio: "+ratio)
      }

      ratio = +process.env.BASEMAP_ZOOM_RATIO || 0.42 // CUSTOM: we fix it so that it is constant from one map to another (since this is 4K with about the same number of nodes)
      
      // Resize
      /*g.nodes().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        n.x = m.l + (dim.w-m.r-m.l) / 2 + (n.x - xcenter) * ratio
        n.y = m.t + (dim.h-m.t-m.b) / 2 + (n.y - ycenter) * ratio
        n.size *= ratio
      })*/
      // CUSTOM: we resize around the barycenter
      // First, let's center on zero.
      let everything = {x:0, y:0, count:0}
      g.nodes().forEach((nid,i) => {
        const n = g.getNodeAttributes(nid)
        everything.count++
        everything.x += +n.x
        everything.y += +n.y
      })
      everything.x /= everything.count
      everything.y /= everything.count
      g.nodes().forEach((nid,i) => {
        const n = g.getNodeAttributes(nid)
        n.x -= everything.x
        n.y -= everything.y
      })
      ns.rescaler.push(xy => [xy[0]-everything.x, xy[1]-everything.y])

      g.nodes().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        n.x = m.l + 0.5*(dim.w-m.r-m.l) + (n.x - everything.x) * ratio
        n.y = m.t + 0.6*(dim.h-m.t-m.b) + (n.y - everything.y) * ratio
        n.size *= ratio
      })
      ns.rescaler.push(xy => [m.l + 0.5*(dim.w-m.r-m.l) + (xy[0] - everything.x) * ratio, m.t + 0.6*(dim.h-m.t-m.b) + (xy[1] - everything.y) * ratio])

      // // Test ns.rescaler
      // let datum = [1,1]
      // ns.rescaler.forEach(f => {
      //   datum = f(datum)
      // })
      // console.log("Rescale [1,1]", datum)

      ns.report("...done.")
    }

    ns.mm_to_px = function(d) {
      return d * ns.settings.rendering_dpi * 0.0393701 / ns.settings.tile_factor
    }

    ns.pt_to_px = function(d) {
      return Math.round(1000 * d * ns.settings.rendering_dpi / ( 72 * ns.settings.tile_factor )) / 1000
    }

    ns.px_to_pt = function(d) {
      return Math.round(1000 * d * ( 72 * ns.settings.tile_factor ) / ns.settings.rendering_dpi) / 1000
    }

    //// LOG
    ns.log = function(txt) {
      console.log(txt)
      ns.logTime = Date.now()
    }
    ns.report = function(txt) {
      if (ns.logTime) {
        var time = Date.now() - ns.logTime
        time /= 1000
        txt += " TIME: "+time+" s"
      }
      console.log(txt)
      ns.logTime = Date.now()
    }
    ns.log2 = function(txt) {
      console.log('\t'+txt)
      ns.logTime2 = Date.now()
    }
    ns.report2 = function(txt) {
      if (ns.logTime2) {
        var time = Date.now() - ns.logTime2
        time /= 1000
        txt += " TIME: "+time+" s"
      }
      console.log('\t'+txt)
      ns.logTime2 = Date.now()
    }

    return ns
  }

  /// FINALLY, RENDER
  let renderer = newRenderer()
  let r = await renderer.renderAndGetImgd(g, settings) // Custom
  return new Promise((resolve, reject) => {
    resolve(r)
  });
}
