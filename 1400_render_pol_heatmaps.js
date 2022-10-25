import Graph from "graphology";
import gexf from "graphology-gexf";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"
import * as d3 from 'd3';
import dotenv from "dotenv";

dotenv.config();

export async function render_pol_heatmaps(date) {
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

  // Note about resolution:
  // Photo posters on PixArtPrinting
  // are up to 1480 x 5000 mm and 1440 or even 2880 dpi.
  // https://www.pixartprinting.fr/grand-format/impression-poster-haute-qualite/
  //
  // The script works (for me) eith 1000 x 1000 mm and 1440 dpi.

  /// EDIT SETTINGS BELOW

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

  // Tiling:
  // Tiling allows to build images that would be otherwise too large.
  // You will have to assemble them by yourself.
  settings.tile_factor = 1 // Integer, default 1. Number of rows and columns of the grid of exported images.
  settings.tile_to_render = [0, 0] // Grid coordinates, as integers

  // Layers:
  // Decide which layers are drawn.
  // The settings for each layer are below.
  settings.draw_background            = true
  settings.draw_nodes                 = true

  // Layer: Background
  settings.background_color = "#000000"

  // Layer: Nodes
  settings.adjust_voronoi_range = 100 // Factor // Larger node halo
  settings.node_size = 3 // Factor to adjust the nodes drawing size
  settings.node_color_original = false // Use the original node color
  settings.node_color_by_modalities = false // Use the modalities to color nodes (using settings.node_clusters)
  settings.node_stroke_width = 0.5 // mm
  settings.node_stroke_color = "#FFFFFF"
  settings.node_fill_color = "#FFFFFF"

  // Advanced settings
  settings.voronoi_range = 1.2 // Halo size in mm
  settings.voronoi_resolution_max = 1 * Math.pow(10, 7) // in pixel. 10^7 still quick, 10^8 better quality 
  settings.heatmap_resolution_max = 1 * Math.pow(10, 5) // in pixel. 10^5 quick. 10^7 nice but super slow.
  settings.heatmap_spreading = 1.5 // in mm

  /// (END OF SETTINGS)

  /// RENDERER
  var newRenderer
  newRenderer = function(){

    // NAMESPACE
    var ns = {}

    // Activate when using Node.js
    ns._nodejs = true

    /// Define renderer
    ns.render = function(g, settings) {
      
      ns.init(g, settings)

      // We draw the image layer by layer.
      // Each layer is drawn separately and merged one after another.
      // But the background is its own thing.
      var bgImage = ns.getEmptyLayer(true)

      // Draw nodes
      if (ns.settings.draw_nodes) {
        bgImage = ns.drawLayerOnTop(bgImage,
          ns.drawNodesLayer(ns.settings)
        )
      }

      // Build final canvas
      var renderingCanvas = ns.createCanvas()
      renderingCanvas.getContext("2d").putImageData(bgImage, 0, 0)
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

    // Render and save
    ns.renderAndSave = async function(g, settings, name) {
      return new Promise(resolve => {
        let canvas = ns.render(g, settings)
        ns.saveCanvas(canvas, name || "output", () =>  {
          console.log('The PNG file was created.')
          resolve()
        })
      })
    }

    // Render all tiles
    ns.renderAndSaveAllTiles = function(g, settings) {
      console.log("Rendering all tiles.")
      if (settings === undefined || settings.tile_factor === undefined) {
        console.error("Tile factor not specified")
        return
      }

      let count = 1
      for (let ti = 0; ti<settings.tile_factor; ti++) {
        for (let tj = 0; tj<settings.tile_factor; tj++) {
          console.log("###### DRAW TILE "+ti+" "+tj+" ("+count+"/"+Math.pow(settings.tile_factor,2)+") ######")
          settings.tile_to_render = [ti, tj]
          let tile = ns.render(g, settings)
          renderer.saveCanvas(tile, "tile "+ti+" "+tj, () =>  console.log("Tile "+ti+" "+tj+".png saved."))
          count++
        }
      }
    }

    /// Initialization
    ns.init = function(g, settings) {
      if (ns._initialized) { return }

      ns.report("Initialization")

      // Default settings
      settings = settings || {}
      settings.image_width = settings.image_width || 150 // in mm. Default: 20mm (fits in a A4 page)
      settings.image_height = settings.image_height || 150
      settings.output_dpi = settings.output_dpi || 300 // Dots per inch. LowRes=72 HighRes=300 PhotoPrint=1440
      settings.rendering_dpi = settings.rendering_dpi || 300 // Default: same as output_dpi. You can over- or under-render to tweak quality and speed.

      // Tiling:
      // Tiling allows to build images that would be otherwise too large.
      // You will have to assemble them by yourself.
      settings.tile_factor = settings.tile_factor || 1 // Integer, default 1. Number of rows and columns of the grid of exported images.
      settings.tile_to_render = settings.tile_to_render || [0, 0] // Grid coordinates, as integers

      // Orientation:
      settings.flip_x = settings.flip_x || false
      settings.flip_y = settings.flip_y || false
      settings.rotate = settings.rotate || 0 // In degrees, clockwise

      // Layers:
      // Decide which layers are drawn.
      // The settings for each layer are below.
      settings.draw_background = (settings.draw_background === undefined)?(true):(settings.draw_background)
      settings.draw_network_shape_fill = settings.draw_network_shape_fill || false
      settings.draw_network_shape_contour = settings.draw_network_shape_contour || false
      settings.draw_edges = (settings.draw_edges === undefined)?(true):(settings.draw_edges)
      settings.draw_nodes = (settings.draw_nodes === undefined)?(true):(settings.draw_nodes)
      settings.draw_node_labels = (settings.draw_node_labels === undefined)?(true):(settings.draw_node_labels)
      // (end of default settings)

      // Make it sure that the image dimension divides nicely in tiles
      ns.settings = settings
      ns.settings.image_width = ns.settings.tile_factor * Math.floor(ns.settings.image_width / ns.settings.tile_factor)
      ns.settings.image_height = ns.settings.tile_factor * Math.floor(ns.settings.image_height / ns.settings.tile_factor)

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

    ns.getHeatmapData = function() {
      // Cache
      if (ns._heatmapData) {
        return ns._heatmapData
      }

      ns.log2("Precompute heatmap data...")

      // Note: here we do not pass specific options, because
      // the method can be called in different drawing contexts
      var options = {}
      options.node_size = 1
      options.resolution_max = ns.settings.heatmap_resolution_max || 1000000 // 1 megapixel.
      options.spread = ns.settings.heatmap_spreading || 1 // in mm
      
      var i, x, y, d, h, ratio, width, height
      var g = ns.g
      // Note we use native dimensions here (not rescaled by tiles)
      // because for the tiles to join perfectly, this must always be
      // computed for the whole set of nodes, i.e. on the untiled image.
      // Performance is managed with a different system (see the ratio below).
      var dim = {
        w: Math.floor(ns.settings.image_width * ns.settings.rendering_dpi * 0.0393701),
        h: Math.floor(ns.settings.image_height * ns.settings.rendering_dpi * 0.0393701)
      }

      // Ratio
      if (dim.w*dim.h>options.resolution_max) {
        ratio = Math.sqrt(options.resolution_max/(dim.w*dim.h))
        width = Math.floor(ratio*dim.w)
        height = Math.floor(ratio*dim.h)
      } else {
        ratio = 1
        width = dim.w
        height = dim.h
      }
      console.log("Heat map ratio:",ratio,"- Dimensions: "+width+" x "+height)

      // Init a pixel map of floats for heat
      var hPixelMap = new Float64Array((width+1) * (height+1))
      for (i in hPixelMap) {
        hPixelMap[i] = 0
      }

      // Compute the heat using the pixel map
      var spread = options.spread * ratio * ns.settings.rendering_dpi * 0.0393701
      g.nodes().forEach(nid => {
        var n = g.getNodeAttributes(nid)
        var nsize = ratio * n.size * options.node_size * ns.settings.tile_factor
        var nx = ratio * n.x * ns.settings.tile_factor
        var ny = ratio * n.y * ns.settings.tile_factor
        for (x = 0; x <= width; x++ ){
          for (y = 0; y <= height; y++ ){
            i = x + (width+1) * y
            d = Math.sqrt(Math.pow(nx - x, 2) + Math.pow(ny - y, 2))
            d = Math.max(0, d-nsize) // In test
            h = 1 / (1+Math.pow(d/spread, 2))
            hPixelMap[i] = hPixelMap[i] + h
          }
        }
      })

      // Normalize
      hPixelMap = hPixelMap.map(h => h/g.order) // helps consistency across networks
      var hMax = -Infinity
      hPixelMap.forEach(h => {
        hMax = Math.max(h, hMax)
      })
      // Note: we do not actually normalize
      // for the sake of consistency.
      // Indeed, the actual max depends on the resolution,
      // which we do not want. So we keep the raw data
      // as a basis and we only normalize if needed.
      // That's why hMax is exported in the data bundle.
      // hPixelMap = hPixelMap.map(h => h/hMax)

      ns.report2("...done.")
      ns._heatmapData = {
        hPixelMap:hPixelMap,
        hMax: hMax,
        width:width,
        height:height,
        ratio:ratio
      }
      return ns._heatmapData
    }

    ns.overlayLayer = function(backgroundImg, layerImg, mode) {
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ctx.putImageData(backgroundImg, 0, 0)
      ctx.globalCompositeOperation = mode || "hard-light"

      var canvas2 = ns.createCanvas()
      canvas2.getContext("2d").putImageData(layerImg, 0, 0)
      ctx.drawImage(canvas2, 0, 0)

      return ctx.getImageData(0, 0, backgroundImg.width, backgroundImg.height)
    }

    ns.getNodesBySize = function() {
      // Cache
      if (ns._nodesBySize) {
        return ns._nodesBySize
      }

      ns.log2("Precompute nodes by size...")

      var g = ns.g

      // Order nodes by size to draw with the right priority
      var nodesBySize = g.nodes().slice(0)
      // We sort nodes by 1) size and 2) left to right
      nodesBySize.sort(function(naid, nbid){
        var na = g.getNodeAttributes(naid)
        var nb = g.getNodeAttributes(nbid)
        
        // Custom (important)
        if (na.important) {
          return -1
        } else if (nb.important) {
          return 1
        }

        if ( na.size < nb.size ) {
          return 1
        } else if ( na.size > nb.size ) {
          return -1
        } else if ( na.x < nb.x ) {
          return 1
        } else if ( na.x > nb.x ) {
          return -1
        }
        return 0
      })
      nodesBySize.reverse() // Because we draw from background to foreground
      ns._nodesBySize = nodesBySize

      ns.report2("...done.")
      return nodesBySize
    }

    ns.getVoronoiData = function() {
      // Cache
      if (ns._voronoiData) {
        return ns._voronoiData
      }

      ns.log2("Precompute Voronoï data...")

      var i, x, y, d, ratio, width, height
      var g = ns.g
      // Note we use native dimensions for the voronoï (not rescaled by tiles)
      // because for the tiles to join perfectly, the voronoï must always be
      // computed for the whole set of nodes, i.e. on the untiled image.
      // Performance is managed with a different system (see the ratio below).
      var dim = {
        w: Math.floor(ns.settings.image_width * ns.settings.rendering_dpi * 0.0393701),
        h: Math.floor(ns.settings.image_height * ns.settings.rendering_dpi * 0.0393701)
      }

      // Note: here we do not pass specific options, because
      // the method can be called in different drawing contexts
      var options = {}
      options.node_size = 1
      options.voronoi_resolution_max = ns.settings.voronoi_resolution_max || 100000000 // 100 megapixel.
      options.voronoi_range = ns.settings.voronoi_range * ns.settings.rendering_dpi * 0.0393701
      
      // Ratio
      if (dim.w*dim.h>options.voronoi_resolution_max) {
        ratio = Math.sqrt(options.voronoi_resolution_max/(dim.w*dim.h))
        width = Math.floor(ratio*dim.w)
        height = Math.floor(ratio*dim.h)
      } else {
        ratio = 1
        width = dim.w
        height = dim.h
      }
      console.log("Voronoï ratio:",ratio,"- Dimensions: "+width+" x "+height)

      // Get an index of nodes where ids are integers
      var nodesIndex = g.nodes().slice(0)
      nodesIndex.unshift(null) // We reserve 0 for "no closest"

      // Save this "voronoi id" as a node attribute
      nodesIndex.forEach(function(nid, vid){
        if (vid > 0) {
          var n = g.getNodeAttributes(nid)
          n.vid = vid
        }
      })

      // Init a pixel map of integers for voronoi ids
      var vidPixelMap
      if (g.order < 255) {
        vidPixelMap = new Uint8Array((width+1) * (height+1))
      } else if (g.order < 65535) {
        vidPixelMap = new Uint16Array((width+1) * (height+1))
      } else {
        vidPixelMap = new Uint32Array((width+1) * (height+1))
      }
      for (i in vidPixelMap) {
        vidPixelMap[i] = 0
      }

      // Init a pixel map of floats for distances
      var dPixelMap = new Uint8Array((width+1) * (height+1))
      for (i in dPixelMap) {
        dPixelMap[i] = 255
      }

      // Compute the voronoi using the pixel map
      g.nodes().forEach(nid => {
        var n = g.getNodeAttributes(nid)
        var nsize = ratio * n.size * options.node_size * ns.settings.tile_factor
        var nx = ratio * n.x * ns.settings.tile_factor
        var ny = ratio * n.y * ns.settings.tile_factor
        var range = nsize + options.voronoi_range * ratio
        for (x = Math.max(0, Math.floor(nx - range) ); x <= Math.min(width, Math.floor(nx + range) ); x++ ){
          for (y = Math.max(0, Math.floor(ny - range) ); y <= Math.min(height, Math.floor(ny + range) ); y++ ){
            d = Math.sqrt(Math.pow(nx - x, 2) + Math.pow(ny - y, 2))
     
            if (d < range) {
              var dmod // A tweak of the voronoi: a modified distance in [0,1]
              if (d <= nsize) {
                // "Inside" the node
                dmod = 0
              } else {
                // In the halo range
                dmod = (d - nsize) / (options.voronoi_range  * ratio)
              }
              i = x + (width+1) * y
              var existingVid = vidPixelMap[i]
              if (existingVid == 0) {
                // 0 means there is no closest node
                vidPixelMap[i] = n.vid
                dPixelMap[i] = Math.floor(dmod*255)
              } else {
                // There is already a closest node. Edit only if we are closer.
                if (dmod*255 < dPixelMap[i]) {
                  vidPixelMap[i] = n.vid
                  dPixelMap[i] = Math.floor(dmod*255)
                }
              }
            }
          }
        }
      })

      ns.report2("...done.")
      ns._voronoiData = {
        nodesIndex: nodesIndex,
        vidPixelMap: vidPixelMap,
        dPixelMap:dPixelMap,
        width:width,
        height:height,
        ratio:ratio
      }
      return ns._voronoiData
    }

    ns.getNodeColor = function(options, n) {
      options = options || {}
      
      if (options.node_color_original) {
        return n.color || options.node_fill_color
      } else if (options.node_color_by_modalities) {
        var modality = settings.node_clusters.modalities[n[settings.node_clusters.attribute_id]]
        var ncol
        if (modality) {
          ncol = d3.color(modality.color)
        } else {
          ncol = d3.color(settings.node_clusters.default_color || "#8B8B8B")
        }
        // Custom
        return ncol.toString()
      } else {
        ncol = d3.color(options.node_fill_color)
        ncol.opacity = Math.round(100*n.score)/100
        return ncol.toString()
      }
    }

    ns.drawNodesLayer = function(options) {
      ns.log("Draw nodes...")

      options = options || {}
      options.node_size = options.node_size || 1
      options.node_stroke = (options.node_stroke===undefined)?(true):(options.node_stroke)
      options.node_stroke_width = options.node_stroke_width || 0.08 // in mm
      options.node_color_original = (options.node_color_original===undefined)?(false):(options.node_color_original)
      options.node_color_by_modalities = (options.node_color_by_modalities===undefined)?(false):(options.node_color_by_modalities)
      options.node_fill_color = options.node_fill_color || "#FFF"
      options.node_stroke_color = options.node_stroke_color || "#303040"
      options.blur_radius = 2 // In mm

      var g = ns.g
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      // Background
      ns.paintAll(ctx, options.background_color)

      // Node dots
      var stroke_width = ns.mm_to_px(options.node_stroke_width)

      // First, we draw the nodes large and with opacity
      ns.getNodesBySize().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        var color = ns.getNodeColor(options, n)
        var radius = options.node_size * n.size

        // Custom: we add an offset to the node radius
        radius += ns.mm_to_px(0.025 /* in mm */)

        ctx.lineCap="round"
        ctx.lineJoin="round"

        ctx.beginPath()
        ctx.arc(n.x, n.y, radius + 0.5*stroke_width, 0, 2 * Math.PI, false)
        ctx.lineWidth = 0
        ctx.fillStyle = color
        ctx.shadowColor = 'transparent'
        ctx.fill()
      })

      // Then we blur
      var imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
      var blurRadius = ns.mm_to_px(options.blur_radius) * ns.settings.tile_factor
      imgd = ns.blur(imgd, blurRadius, ctx)
      ctx.putImageData(imgd, 0, 0);

      // Then, we redraw the nodes but playing on the radius
      /*ns.getNodesBySize().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        var radius = n.size
        radius *= n.score

        ctx.lineCap="round"
        ctx.lineJoin="round"

        ctx.beginPath()
        ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI, false)
        ctx.lineWidth = 0
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)"
        ctx.shadowColor = 'transparent'
        ctx.fill()

      })*/

      ns.report("...done.")
      // return imgd
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    }

    ns.paintAll = function(ctx, color) {
      ctx.beginPath()
      ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.fillStyle = color
      ctx.fill()
      ctx.closePath()
    }

    ns.multiplyAlpha = function(imgd, alpha) {
      var w = imgd.width
      var h = imgd.height
      var pix = imgd.data
      
      // output
      var co = ns.createCanvas()
      co.width = w
      co.height = h
      var imgdo = co.getContext("2d").createImageData(w,h)
      var pixo = imgdo.data

      for ( var i = 0, pixlen = pixo.length; i < pixlen; i += 4 ) {
        pixo[i+0] = pix[i+0]
        pixo[i+1] = pix[i+1]
        pixo[i+2] = pix[i+2]
        pixo[i+3] = Math.floor(alpha * pix[i+3])
      }

      return imgdo
    }

    ns.drawLayerOnTop = function(bottomLayer, topLayer) {

      // New Canvas
      var newCanvas = ns.createCanvas()
      newCanvas.width = bottomLayer.width
      newCanvas.height = bottomLayer.height
      var ctx = newCanvas.getContext("2d")

      // Paint bottom layer
      ctx.putImageData(bottomLayer, 0, 0)

      // Create temporary canvas for top layer
      var canvas2=ns.createCanvas()
      canvas2.width=topLayer.width
      canvas2.height=topLayer.height
      var ctx2=canvas2.getContext("2d")
      ctx2.putImageData(topLayer, 0, 0)

      ctx.drawImage(canvas2,0,0);

      return ctx.getImageData(0, 0, bottomLayer.width, bottomLayer.height)
    }

    ns.getEmptyLayer = function(paintWhite) {
      let dim = ns.getRenderingPixelDimensions()
      let canvas = ns.createCanvas()
      let ctx = canvas.getContext("2d")
      if (paintWhite) {
        ns.paintAll(ctx, "#FFFFFF")
      }
      return ctx.getImageData(0, 0, dim.w, dim.h)
    }

    ns.mergeLayers = function(layers) {
      if (layers.length > 0) {
        var imgd_bottom = layers.shift()
        var imgd_top
        while (imgd_top = layers.shift()) {
          imgd_bottom = ns.drawLayerOnTop(imgd_bottom, imgd_top)
        }
        return imgd_bottom
      } else {
        var ctx = ns.createCanvas().getContext("2d")
        return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
      }
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
        alert('Note: '+coordinateIssues+' nodes had coordinate issues. We carelessly fixed them.')
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

      // Flip
      if (options.flip_x) {
        g.nodes().forEach(function(nid){
          var n = g.getNodeAttributes(nid)
          n.x = -n.x
        })
      }
      if (options.flip_y) {
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
      g.nodes().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        n.x = m.l + 0.5*(dim.w-m.r-m.l) + (n.x - everything.x) * ratio
        n.y = m.t + 0.6*(dim.h-m.t-m.b) + (n.y - everything.y) * ratio
        n.size *= ratio
      })
      ns.report("...done.")
    }

    ns.blur = function(imgd, r, _ctx) {
      var i
      var w = imgd.width
      var h = imgd.height
      var pix = imgd.data
      var pixlen = pix.length
      // output
      var imgdo = _ctx.createImageData(w,h)
      var pixo = imgdo.data

      // Split channels
      var channels = [] // rgba
      for ( i=0; i<4; i++) {
        var channel = new Uint8ClampedArray(pixlen/4);
        channels.push(channel)
      }
      for ( i = 0; i < pixlen; i += 4 ) {
        channels[0][i/4] = pix[i  ]
        channels[1][i/4] = pix[i+1]
        channels[2][i/4] = pix[i+2]
        channels[3][i/4] = pix[i+3]
      }

      channels.forEach(function(scl){
        var tcl = scl.slice(0)
        var bxs = ns.boxesForGauss(r, 3);
        ns.boxBlur (scl, tcl, w, h, (bxs[0]-1)/2);
        ns.boxBlur (tcl, scl, w, h, (bxs[1]-1)/2);
        ns.boxBlur (scl, tcl, w, h, (bxs[2]-1)/2);
        scl = tcl
      })

      // Merge channels
      for ( var i = 0, pixlen = pixo.length; i < pixlen; i += 4 ) {
        pixo[i  ] = channels[0][i/4]
        pixo[i+1] = channels[1][i/4]
        pixo[i+2] = channels[2][i/4]
        pixo[i+3] = channels[3][i/4]
      }

      return imgdo
    }

    // From http://blog.ivank.net/fastest-gaussian-blur.html
    ns.boxesForGauss = function(sigma, n) { // standard deviation, number of boxes

      var wIdeal = Math.sqrt((12*sigma*sigma/n)+1);  // Ideal averaging filter width 
      var wl = Math.floor(wIdeal);  if(wl%2==0) wl--;
      var wu = wl+2;
      
      var mIdeal = (12*sigma*sigma - n*wl*wl - 4*n*wl - 3*n)/(-4*wl - 4);
      var m = Math.round(mIdeal);
      // var sigmaActual = Math.sqrt( (m*wl*wl + (n-m)*wu*wu - n)/12 );
          
      var sizes = [];  for(var i=0; i<n; i++) sizes.push(i<m?wl:wu);
      return sizes;
    }

    ns.boxBlur = function(scl, tcl, w, h, r) {
      for(var i=0; i<scl.length; i++) tcl[i] = scl[i];
      ns.boxBlurH(tcl, scl, w, h, r);
      ns.boxBlurT(scl, tcl, w, h, r);
    }

    ns.boxBlurH = function(scl, tcl, w, h, r) {
      var iarr = 1 / (r+r+1);
      for(var i=0; i<h; i++) {
        var ti = i*w, li = ti, ri = ti+r;
        var fv = scl[ti], lv = scl[ti+w-1], val = (r+1)*fv;
        for(var j=0; j<r; j++) val += scl[ti+j];
        for(var j=0  ; j<=r ; j++) { val += scl[ri++] - fv       ;   tcl[ti++] = Math.round(val*iarr); }
        for(var j=r+1; j<w-r; j++) { val += scl[ri++] - scl[li++];   tcl[ti++] = Math.round(val*iarr); }
        for(var j=w-r; j<w  ; j++) { val += lv        - scl[li++];   tcl[ti++] = Math.round(val*iarr); }
      }
    }

    ns.boxBlurT = function(scl, tcl, w, h, r) {
      var iarr = 1 / (r+r+1);
      for(var i=0; i<w; i++) {
        var ti = i, li = ti, ri = ti+r*w;
        var fv = scl[ti], lv = scl[ti+w*(h-1)], val = (r+1)*fv;
        for(var j=0; j<r; j++) val += scl[ti+j*w];
        for(var j=0  ; j<=r ; j++) { val += scl[ri] - fv     ;  tcl[ti] = Math.round(val*iarr);  ri+=w; ti+=w; }
        for(var j=r+1; j<h-r; j++) { val += scl[ri] - scl[li];  tcl[ti] = Math.round(val*iarr);  li+=w; ri+=w; ti+=w; }
        for(var j=h-r; j<h  ; j++) { val += lv      - scl[li];  tcl[ti] = Math.round(val*iarr);  li+=w; ti+=w; }
      }
    }

    ns.normalizeAlpha = function(imgd, minalpha, maxalpha, dryWet, _ctx) {
      var w = imgd.width
      var h = imgd.height
      var pix = imgd.data
      // output
      var imgdo = _ctx.createImageData(w,h)
      var pixo = imgdo.data

      var min = Infinity
      var max = 0
      for ( var i = 0, pixlen = pixo.length; i < pixlen; i += 4 ) {
        var a = pix[i+3]
        min = Math.min(a, min)
        max = Math.max(a, max)
      }
      for ( var i = 0, pixlen = pixo.length; i < pixlen; i += 4 ) {
        pixo[i+3] = Math.floor(dryWet * (minalpha + (maxalpha-minalpha)*(pix[i+3]-min)/(max-min)) + (1-dryWet)*pix[i+3])
      }

      return imgdo
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

    ns.downloadImageData = function(imgd, name) {
      // New Canvas
      var canvas = ns.createCanvas(imgd.width, imgd.height)
      var ctx = canvas.getContext("2d")

      // Paint imgd
      ctx.putImageData(imgd, 0, 0)

      // SAVE
      ns.saveCanvas(canvas, name)
    }

    ns.saveCanvas = function(canvas, name, callback) {
      if (ns._nodejs) {
        // Node
        const out = fs.createWriteStream(name+'.png')
        const stream = canvas.createPNGStream()
        stream.pipe(out)
        if (callback) {
          out.on('finish', callback)
        }
      } else {
        // Browser
        canvas.toBlob(function(blob) {
          //saveAs(blob, name + ".png");
        })
      }
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







  const polAffiliations = getPolAffiliations(targetDate)
  for (let pai=0; pai<polAffiliations.length; pai++){
    let polGroup = polAffiliations[pai]
    console.log("\n### Pol group: "+polGroup)
    // Custom modifications
    g.nodes().forEach(nid => {
      let n = g.getNodeAttributes(nid)
      n.score = +n['mp_align_'+polGroup] / +n['mp_align__TOTAL']
    })

    /// FINALLY, RENDER
    let renderer = newRenderer()
    await renderer.renderAndSave(g, settings, thisFolder+'/heatmap pol '+polGroup) // Custom
  }

  function getPolAffiliations(date){
    try {
      // Load affiliations file as string
      const polAffDataJson = fs.readFileSync('political_affiliations.json', "utf8")

      try {
        const polAffData = JSON.parse(polAffDataJson)
        console.log('Political affiliations loaded and parsed');

        let era
        polAffData.eras.forEach(e => {
          let sdate = new Date(e.startDate)
          let edate = new Date(e.endDate)
          if (sdate <= date && date <= edate ) {
            era = e
          }
        })

        if (era===undefined) {
          console.error(`No corresponding era found in political affiliations file`);
        } else {
          let polAff = []
          era.affiliations.forEach(a => {
            polAff.push(a.id)
          })
          return polAff
        }

      } catch (error) {
        console.error("Error: the political affiliations file could not be parsed.", error)
      }
    } catch (error) {
      console.error("Error: the political affiliations file could not be loaded", error)
    }
  }
}

// Command line arguments
// Date argument
let date = undefined
const dateArgRegexp = /d(ate)?=([0-9]{4}\-[0-9]{2}\-[0-9]{2})/i
process.argv.forEach(d => {
  let found = d.match(dateArgRegexp)
  if (found && found[2]) {
    date = found[2]
  }
})
// Auto mode (run the script)
if (process.argv.some(d => ["a","-a","auto","-auto"].includes(d))) {
  console.log("Run script"+((date)?(" on date "+date):("")))
  render_pol_heatmaps(date)
}
