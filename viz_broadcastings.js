import Graph from "graphology";
import gexf from "graphology-gexf";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"
import * as d3 from 'd3';

export async function render_map_4k_no_labels(date) {
  const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
  const year = targetDate.getFullYear()
  const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const thisFolder = `data/${year}/${month}/${datem}`

  // Read file
  var gexf_string, edges_string;
  try {
      gexf_string = fs.readFileSync(thisFolder+'/network_spat.gexf', 'utf8');
      edges_string = fs.readFileSync(thisFolder+'/network_edges_broadcastings_test.csv', 'utf8')
      console.log('GEXF file loaded');
  } catch(e) {
      console.log('Error:', e.stack);
  }

  // Parse string
  var g = gexf.parse(Graph, gexf_string, {addMissingNodes: true});
  console.log('GEXF parsed');
  const edges = d3.csvParse(edges_string);
  edges.forEach(e => {
    if (g.hasNode(e.Source) && g.hasNode(e.Target)) {
      g.mergeEdge(e.Source, e.Target)
    }
  })
  console.log('Edges integrated');

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
  settings.draw_hillshading           = false
  settings.draw_network_shape_fill    = false
  settings.draw_network_shape_contour = false
  settings.draw_cluster_fills         = false
  settings.draw_cluster_contours      = false
  settings.draw_cluster_labels        = false
  settings.draw_edges                 = true
  settings.draw_node_shadows          = false
  settings.draw_nodes                 = true
  settings.draw_node_labels           = false
  settings.draw_connected_closeness   = false

  // Layer: Background
  settings.background_color = "#000000"

  // Layer: Edges
  settings.max_edge_count = Infinity
  settings.edge_thickness = 0.06 // in mm
  settings.edge_alpha = 1 // Opacity // Range from 0 to 1
  settings.edge_curved = false
  settings.edge_high_quality = false // Halo around nodes // Time-consuming
  settings.edge_color = "#FFFFFF"
  settings.edge_path_jitter = 0.2
  settings.edge_path_segment_length = 0.5

  // Layer: Node shadows
  settings.node_color_shadow_offset = 4 // mm; larger than you'd think (gradient)
  settings.node_color_shadow_opacity = .5
  settings.node_color_shadow_blur_radius = 3 // mm

  // Layer: Nodes
  settings.adjust_voronoi_range = 100 // Factor // Larger node halo
  settings.node_size = 1. // Factor to adjust the nodes drawing size
  settings.node_color_original = false // Use the original node color
  settings.node_color_by_modalities = false // Use the modalities to color nodes (using settings.node_clusters)
  settings.node_stroke_width = 0.01 // mm
  settings.node_stroke_color = "#FFFFFF"
  settings.node_fill_color = "#FFFFFF"

  // Main clusters and color code:
  // Clusters are defined by the modalities of a given attribute.
  // This specifies which is this attribute, and which
  // modalities have which colors. You can generate this
  // JSON object with the PREPARE script.
  settings.node_clusters = {
    "attribute_id": "couleur politique",
    "modalities": {
    },
    "default_color": "#afafac"
  }

  // Advanced settings
  settings.voronoi_range = 1.2 // Halo size in mm
  settings.voronoi_resolution_max = 1 * Math.pow(10, 7) // in pixel. 10^7 still quick, 10^8 better quality 
  settings.heatmap_resolution_max = 1 * Math.pow(10, 5) // in pixel. 10^5 quick. 10^7 nice but super slow.
  settings.heatmap_spreading = 1.5 // in mm

  // Experimental stuff
  settings.hillshading_strength = 36
  settings.hillshading_color = "#1B2529"
  settings.hillshading_alpha = .36 // Opacity
  settings.hillshading_sun_azimuth = Math.PI * 0.6 // angle in radians
  settings.hillshading_sun_elevation = Math.PI * 0.35 // angle in radians
  settings.hillshading_hypsometric_gradient = true // Elevation gradient color

  /// (END OF SETTINGS)

  // Custom modifications
  g.nodes().forEach(nid => {
    let n = g.getNodeAttributes(nid)
    n.draw = false
  })
  g.edges().forEach(eid => {
    g.setNodeAttribute(g.source(eid), 'draw', true)
    g.setNodeAttribute(g.target(eid), 'draw', true)
  })

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
      
      // Draw background
      if (ns.settings.draw_background) {
        bgImage = ns.drawLayerOnTop(bgImage,
          ns.drawBackgroundLayer(ns.settings)
        )
      }

      // Draw edges
      if (ns.settings.draw_edges) {
        bgImage = ns.drawLayerOnTop(bgImage,
          ns.drawEdgesLayer(ns.settings)
        )
      }

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

    ns.drawHillshadingGradient = function(options) {
      ns.log("Draw Hillshading Gradient...")
      
      var options = options || {}
      options.hillshading_alpha = options.hillshading_alpha || .5
      options.hillshading_color = options.hillshading_color || "#000"
      options.hillshading_hypsometric_gradient = options.hillshading_hypsometric_gradient || false

      // Monitoring
      options.display_heatmap = false // for monitoring; hillshade is not diplayed, then.

      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      /// Unpack heatmap data
      var shadingData = ns.getHillshadingData()
      
      // Unpack heatmap
      var ratio = 1/shadingData.ratio
      var lPixelMap = new Float64Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
      var heatmapData, hPixelMap
      if (options.display_heatmap || options.hillshading_hypsometric_gradient) {
        heatmapData = ns.getHeatmapData()
        hPixelMap = new Float64Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
      }
      var xu, yu, xp, xp1, xp2, dx, yp, yp1, yp2, dy, ip_top_left, ip_top_right, ip_bottom_left, ip_bottom_right
      for (var i=0; i<lPixelMap.length; i++) {
        // unpacked coordinates
        xu = i%(dim.w * ns.settings.tile_factor)
        yu = (i-xu)/(dim.w * ns.settings.tile_factor)
        // packed coordinates
        xp = xu/ratio
        xp1 = Math.max(0, Math.min(shadingData.width, Math.floor(xp)))
        xp2 = Math.max(0, Math.min(shadingData.width, Math.ceil(xp)))
        dx = (xp-xp1)/(xp2-xp1) || 0
        yp = yu/ratio
        yp1 = Math.max(0, Math.min(shadingData.height, Math.floor(yp)))
        yp2 = Math.max(0, Math.min(shadingData.height, Math.ceil(yp)))
        dy = (yp-yp1)/(yp2-yp1) || 0
        // coordinates of the 4 pixels necessary to rescale
        ip_top_left = xp1 + (shadingData.width+1) * yp1
        ip_top_right = xp2 + (shadingData.width+1) * yp1
        ip_bottom_left = xp1 + (shadingData.width+1) * yp2
        ip_bottom_right = xp2 + (shadingData.width+1) * yp2
        // Rescaling (gradual blending between the 4 pixels)
        lPixelMap[i] =
            (1-dx) * (
              (1-dy) * shadingData.lPixelMap[ip_top_left]
              +  dy  * shadingData.lPixelMap[ip_bottom_left]
            )
          + dx * (
              (1-dy) * shadingData.lPixelMap[ip_top_right]
              +  dy  * shadingData.lPixelMap[ip_bottom_right]
            )
        if (options.display_heatmap || options.hillshading_hypsometric_gradient) {
          hPixelMap[i] =
            (1-dx) * (
                (1-dy) * heatmapData.hPixelMap[ip_top_left]
                +  dy  * heatmapData.hPixelMap[ip_bottom_left]
              )
            + dx * (
                (1-dy) * heatmapData.hPixelMap[ip_top_right]
                +  dy  * heatmapData.hPixelMap[ip_bottom_right]
              )
        }
      }

      if (options.display_heatmap) {
        ns.log2("Draw Heatmap (for monitoring)...")
        let hmData = new Uint8ClampedArray(dim.w * dim.h * 4)
        let xOffset = -dim.w*ns.settings.tile_to_render[0]
        let yOffset = -dim.h*ns.settings.tile_to_render[1]
        hPixelMap.forEach((h,i) => {
          let x = i%(dim.w*ns.settings.tile_factor)
          let y = (i-x)/(dim.w*ns.settings.tile_factor)
          let X = x + xOffset
          let Y = y + yOffset
          if (0 <= X && X <= dim.w && 0 <= Y && Y <= dim.h) {
            let I = X + Y*dim.w
            hmData[4*I  ] = 0
            hmData[4*I+1] = 0
            hmData[4*I+2] = 0
            hmData[4*I+3] = Math.floor(255*(1-h/heatmapData.hMax))
          }
        })
        let hmImgd = new ImageData(hmData, dim.w, dim.h)
        ctx.putImageData(hmImgd,0, 0)
        ns.report2("...done.")
        ns.report("...done.")
        return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
      } else {
        if (options.hillshading_hypsometric_gradient) {
          let mid_threshold = 0.2
          ns.log2("Draw hypsometric gradient...")
          let colorGradient = d3.scaleLinear()
            .domain([0, mid_threshold*0.8, mid_threshold*1.2, 1])
            .range(['#607395', '#cfd9db', '#ebeeea', '#fefefc'])
            .interpolate(d3.interpolateRgb); //interpolateHsl interpolateHcl interpolateRgb
          let hmData = new Uint8ClampedArray(dim.w * dim.h * 4)
          let xOffset = -dim.w*ns.settings.tile_to_render[0]
          let yOffset = -dim.h*ns.settings.tile_to_render[1]
          hPixelMap.forEach((h,i) => {
            let x = i%(dim.w*ns.settings.tile_factor)
            let y = (i-x)/(dim.w*ns.settings.tile_factor)
            let X = x + xOffset
            let Y = y + yOffset
            if (0 <= X && X <= dim.w && 0 <= Y && Y <= dim.h) {
              let I = X + Y*dim.w
              let rgb = d3.color(colorGradient((h||0)/heatmapData.hMax))
              hmData[4*I  ] = rgb.r
              hmData[4*I+1] = rgb.g
              hmData[4*I+2] = rgb.b
              hmData[4*I+3] = 255
            }
          })
          let hmImgd = new ImageData(hmData, dim.w, dim.h)
          ctx.putImageData(hmImgd,0, 0)
          ns.report2("...done.")
        }
      
        ns.log2("Draw hillshade...")
        var lGradient = l => Math.pow(Math.max(0, .2+.8*Math.min(1, 1.4*l||0)), .6)
        var color = d3.color(options.hillshading_color)
        let hsData = new Uint8ClampedArray(dim.w * dim.h * 4)
        let xOffset = -dim.w*ns.settings.tile_to_render[0]
        let yOffset = -dim.h*ns.settings.tile_to_render[1]
        lPixelMap.forEach((l,i) => {
          let x = i%(dim.w*ns.settings.tile_factor)
          let y = (i-x)/(dim.w*ns.settings.tile_factor)
          let X = x + xOffset
          let Y = y + yOffset
          if (0 <= X && X <= dim.w && 0 <= Y && Y <= dim.h) {
            let I = X + Y*dim.w
            hsData[4*I  ] = color.r
            hsData[4*I+1] = color.g
            hsData[4*I+2] = color.b
            hsData[4*I+3] = Math.floor(255*(1-lGradient(l)))
          }
        })
        let hsImgd = new ImageData(hsData, dim.w, dim.h)
        let imgd = ns.overlayLayer(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height), hsImgd, "multiply")
        ctx.putImageData(imgd,0, 0)
        ns.report2("...done.")
      }

      ns.report("...done.")
      return ns.multiplyAlpha(
        ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height),
        options.hillshading_alpha
      )
    }

    ns.getHillshadingData = function() {
      // Cache
      if (ns._hillshadingData) {
        return ns._hillshadingData
      }
      ns.log2("Precompute hillshading...")

      var options = {}
      options.elevation_strength = ns.settings.hillshading_strength || 100
      options.hillshading_sun_azimuth = ns.settings.hillshading_sun_azimuth || Math.PI * 1/2
      options.hillshading_sun_elevation = ns.settings.hillshading_sun_elevation || Math.PI * 1/3

      var heatmapData = ns.getHeatmapData()
      // Note: width, height and ratio are always the same as the heatmap
      var width = heatmapData.width
      var height = heatmapData.height
      var ratio = heatmapData.ratio

      // Hillshading formulas from https://observablehq.com/@sahilchinoy/hillshader
      var getSlope = (dzdx, dzdy, z=.2) => Math.atan(z * Math.sqrt(dzdx ** 2 + dzdy ** 2)); // the z factor controls how exaggerated the peaks look
      var getAspect = (dzdx, dzdy) => { return Math.atan2(-dzdy, -dzdx); }
      var getReflectance = function(aspect, slope, sunAzimuth, sunElevation) {
        return Math.cos(Math.PI - aspect - sunAzimuth) * Math.sin(slope) * Math.sin(Math.PI * .5 - sunElevation) + 
          Math.cos(slope) * Math.cos(Math.PI * .5 - sunElevation);
      }
      var hmax = 0
      var lPixelMap = new Float64Array((width+1) * (height+1))
      var hPixelMap = new Float64Array((width+1) * (height+1))
      var dxPixelMap = new Float64Array((width+1) * (height+1))
      var dyPixelMap = new Float64Array((width+1) * (height+1))
      heatmapData.hPixelMap.forEach((h,i) => {
        // We search the indexes of pixels on the left, right, top and bottom.
        // If on border, we use the central pixel instead.
        i = +i
        var x = i%(width+1)
        var y = (i-x)/(width+1)
        var i_left = (i%(width+1) == 0) ? (i) : (i-1)
        var i_right = (i%(width+1) == (width+1) - 1) ? (i) : (i+1)
        var i_top = (i < (width+1)) ? (i) : (i - (width+1))
        var i_bottom = (i > (width+1) * ((height+1) - 1)) ? (i) : (i + (width+1))
        var hleft = heatmapData.hPixelMap[i_left]
        var hright = heatmapData.hPixelMap[i_right]
        var htop = heatmapData.hPixelMap[i_top]
        var hbottom = heatmapData.hPixelMap[i_bottom]
        var dx = hleft - hright
        var dy = htop - hbottom
        var slope = getSlope(dx, dy, options.elevation_strength * Math.sqrt(width * height))
        var aspect = getAspect(dx, dy)
        var L = getReflectance(aspect, slope, options.hillshading_sun_azimuth, options.hillshading_sun_elevation)
        var h = (hleft+hright+htop+hbottom)/4 || 0
        hmax = Math.max(hmax, h)
        hPixelMap[i] = h
        lPixelMap[i] = L
        dxPixelMap[i] = dx
        dyPixelMap[i] = dy
      })
      ns.report2("...done.")
      ns._hillshadingData = {
        lPixelMap: lPixelMap,
        hPixelMap: hPixelMap.map(h => {return h/hmax}),
        dxPixelMap: dxPixelMap,
        dyPixelMap: dyPixelMap,
        width: width,
        height: height,
        ratio: ratio
      }
      return ns._hillshadingData
    }

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

    ns.drawConnectedClosenessGrid = function(options) {
      ns.log("Draw connected-closeness grid...")

      options = options || {}
      options.C_max_threshold = options.C_max_threshold || 0.1 // Below this, CC is not applicable.
      options.cc_draw_grid = (options.cc_draw_grid === undefined)?(true):(options.cc_draw_grid)
      options.cc_grid_line_thickness = options.cc_grid_line_thickness || .1 // in mm.
      options.cc_grid_line_color = options.cc_grid_line_color || "#666"
      options.margin_bottom = (options.margin_bottom === undefined)?(24):(options.margin_bottom) // in mm, space for the text etc.
      options.margin_right  = (options.margin_right  === undefined)?(12):(options.margin_right ) // in mm, space for the text etc.
      options.margin_left   = (options.margin_left   === undefined)?(3 ):(options.margin_left  ) // in mm, space for the text etc.
      options.margin_top    = (options.margin_top    === undefined)?(6 ):(options.margin_top   ) // in mm, space for the text etc.
      options.cc_info_margin_offset = options.cc_info_margin_offset || 3 // in mm, additional spacing outside the margins

      var ccData = ns.computeConnectedCloseness()
      var Delta_max = ccData.Delta_max;
      var C_max = ccData.C_max;
      
      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)
      
      var margin_bottom = ns.mm_to_px(options.margin_bottom - options.cc_info_margin_offset)
      var margin_right  = ns.mm_to_px(options.margin_right + options.cc_info_margin_offset)
      var margin_left   = ns.mm_to_px(options.margin_left - options.cc_info_margin_offset)
      var margin_top    = ns.mm_to_px(options.margin_top + options.cc_info_margin_offset)
      var centerPoint = {x: margin_left + (dim.w-margin_left-margin_right)/2, y:margin_top + (dim.h-margin_top-margin_bottom)/2}

      if (C_max >= options.C_max_threshold) {
        if (options.cc_draw_grid) {
          drawGrid(ctx, Delta_max, centerPoint.x, centerPoint.y)
        }
      }

      ns.log("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)

      // Internal methods
      function drawGrid(ctx, D, cx, cy) {
        var gridThickness = ns.mm_to_px(options.cc_grid_line_thickness);
        ctx.strokeStyle = options.cc_grid_line_color
        ctx.lineCap="round";
        ctx.lineJoin="round";
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.lineWidth = gridThickness

        for (let d=0.5 * D; d<Math.max(cx, dim.w-cx, cy, dim.h-cy); d+=D) {
          ctx.beginPath();
          ctx.moveTo(0, cy + d);
          ctx.lineTo(dim.w, cy + d);
          ctx.moveTo(0, cy - d);
          ctx.lineTo(dim.w, cy - d);
          ctx.moveTo(cx + d, 0);
          ctx.lineTo(cx + d, dim.h);
          ctx.moveTo(cx - d, 0);
          ctx.lineTo(cx - d, dim.h);
          ctx.stroke();
          ctx.closePath();
        }
      }
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

    ns.getModalities = function() {
      // Cache
      if (ns._modalities) {
        return ns._modalities
      }

      if (!ns.settings.node_clusters || !ns.settings.node_clusters.attribute_id) {
        console.warn("/!\ settings.node_clusters.attribute_id is missing. No modality used.")
        return []
      }

      var node_clusters_issue = false
      if (!ns.settings.cluster_all_modalities) {
        if (ns.settings.node_clusters && ns.settings.node_clusters.modalities) {
          ns._modalities = Object.keys(ns.settings.node_clusters.modalities)
          return ns._modalities
        } else {
          console.warn("/!\ settings.node_clusters.modalities is missing. All modalities used.")
          node_clusters_issue = true
        }
      }
      if (ns.settings.cluster_all_modalities || node_clusters_issue) {
        ns.log2("Precompute modalities...")
        var modalitiesIndex = {}
        var g = ns.g
        g.nodes().forEach(function(nid){
          var modality = g.getNodeAttribute(nid, ns.settings.node_clusters.attribute_id)
          modalitiesIndex[modality] = true
        })
        ns.report2("...done.")
        ns._modalities = Object.keys(modalitiesIndex)
        return ns._modalities
      }
    }

    ns.getNodeSizeExtent = function() {
      // Cache
      if (ns._nodeSizeExtent) {
        return ns._nodeSizeExtent
      }

      // Compute scale for labels
      var g = ns.g
      var nodeSizeExtent = d3.extent(
        g.nodes().map(function(nid){
          return g.getNodeAttribute(nid, "size")
        })
      )
      if (nodeSizeExtent[0] == nodeSizeExtent[1]) { nodeSizeExtent[0] *= 0.9 }
      ns._nodeSizeExtent = nodeSizeExtent
      return nodeSizeExtent
    }

    ns.drawEdgesLayer = function(options) {
      ns.log("Draw edges...")
       
      var options = options || {}
      options.max_edge_count = (options.max_edge_count === undefined)?(Infinity):(options.max_edge_count) // for monitoring only
      options.edge_thickness = options.edge_thickness || 0.05 // in mm
      options.edge_alpha = (options.edge_alpha===undefined)?(1):(options.edge_alpha) // from 0 to 1
      options.edge_color = options.edge_color || "#303040"
      options.edge_curved = (options.edge_curved===undefined)?(true):(options.edge_curved)
      options.edge_curvature_deviation_angle = options.edge_curvature_deviation_angle || Math.PI / 12 // in radians
      options.edge_high_quality = options.edge_high_quality || false
      options.edge_path_jitter = (options.edge_path_jitter === undefined)?(0.00):(options.edge_path_jitter) // in mm
      options.edge_path_segment_length = (options.edge_path_segment_length === undefined)?(options.edge_high_quality?.2:2):(options.edge_path_segment_length) // in mm
      // Monitoring options
      options.display_voronoi = false // for monitoring purpose
      options.display_edges = true // disable for monitoring purpose

      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      var gradient = function(d){
        return Math.round(10000*
          (0.5 + 0.5 * Math.cos(Math.PI - Math.pow(d, 2) * Math.PI))
        )/10000
      }

      var dPixelMap_u, vidPixelMap_u // unpacked versions
      if (options.display_voronoi || options.edge_high_quality) {
        var voronoiData = ns.getVoronoiData()
        
        // Unpack voronoi
        ns.log2("Rescale Voronoï to actual draw space...")
        var ratio = 1/voronoiData.ratio
        if (g.order < 255) {
          vidPixelMap_u = new Uint8Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
        } else if (g.order < 65535) {
          vidPixelMap_u = new Uint16Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
        } else {
          vidPixelMap_u = new Uint32Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
        }
        dPixelMap_u = new Uint8Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
        var xu, yu, xp, xp1, xp2, dx, yp, yp1, yp2, dy, ip_top_left, ip_top_right, ip_bottom_left, ip_bottom_right
        for (var i=0; i<vidPixelMap_u.length; i++) {
          // unpacked coordinates
          xu = i%(dim.w * ns.settings.tile_factor)
          yu = (i-xu)/(dim.w * ns.settings.tile_factor)
          // packed coordinates
          xp = xu/ratio
          xp1 = Math.max(0, Math.min(voronoiData.width, Math.floor(xp)))
          xp2 = Math.max(0, Math.min(voronoiData.width, Math.ceil(xp)))
          dx = (xp-xp1)/(xp2-xp1) || 0
          yp = yu/ratio
          yp1 = Math.max(0, Math.min(voronoiData.height, Math.floor(yp)))
          yp2 = Math.max(0, Math.min(voronoiData.height, Math.ceil(yp)))
          dy = (yp-yp1)/(yp2-yp1) || 0
          // coordinates of the 4 pixels necessary to rescale
          ip_top_left = xp1 + (voronoiData.width+1) * yp1
          ip_top_right = xp2 + (voronoiData.width+1) * yp1
          ip_bottom_left = xp1 + (voronoiData.width+1) * yp2
          ip_bottom_right = xp2 + (voronoiData.width+1) * yp2
          // Rescaling (gradual blending between the 4 pixels)
          dPixelMap_u[i] =
              (1-dx) * (
                (1-dy) * voronoiData.dPixelMap[ip_top_left]
                +  dy  * voronoiData.dPixelMap[ip_bottom_left]
              )
            + dx * (
                (1-dy) * voronoiData.dPixelMap[ip_top_right]
                +  dy  * voronoiData.dPixelMap[ip_bottom_right]
              )
          // For vid we use only one (it's not a number but an id)
          if (dx<0.5) {
            if (dy<0.5) {
              vidPixelMap_u[i] = voronoiData.vidPixelMap[ip_top_left]
            } else {
              vidPixelMap_u[i] = voronoiData.vidPixelMap[ip_bottom_left]
            }
          } else {
            if (dy<0.5) {
              vidPixelMap_u[i] = voronoiData.vidPixelMap[ip_top_right]
            } else {
              vidPixelMap_u[i] = voronoiData.vidPixelMap[ip_bottom_right]
            }
          }
        }
        ns.report2("...done.")
      }

      if (options.display_voronoi) {
        ns.log2("Draw Voronoï (for monitoring)...")
        let vData = new Uint8ClampedArray(dim.w * dim.h * 4)
        let xOffset = -dim.w*ns.settings.tile_to_render[0]
        let yOffset = -dim.h*ns.settings.tile_to_render[1]
        dPixelMap_u.forEach((d,i) => {
          let x = i%(dim.w*ns.settings.tile_factor)
          let y = (i-x)/(dim.w*ns.settings.tile_factor)
          let X = x + xOffset
          let Y = y + yOffset
          if (0 <= X && X <= dim.w && 0 <= Y && Y <= dim.h) {
            let I = X + Y*dim.w
            vData[4*I  ] = 0
            vData[4*I+1] = 0
            vData[4*I+2] = 0
            vData[4*I+3] = Math.floor(255*gradient(d/255))
          }
        })
        let vImgd = new ImageData(vData, dim.w, dim.h)
        ctx.putImageData(vImgd,0, 0)
        ns.report2("...done.")
      }

      // Draw each edge
      // var color = d3.color(options.edge_color) // Custom. See below: edges colored as their target
      var thickness = ns.mm_to_px(options.edge_thickness)
      var jitter = ns.mm_to_px(options.edge_path_jitter)
      var tf = ns.settings.tile_factor
      if (options.display_edges) {
        ctx.lineCap="round"
        ctx.lineJoin="round"
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        g.edges()
          .filter(function(eid, i_){ return i_ < options.max_edge_count })
          .forEach(function(eid, i_){
            var color = d3.color(options.edge_color)
            if ((i_+1)%10000 == 0) {
              console.log("..."+(i_+1)/1000+"K edges drawn...")
            }
            var n_s = g.getNodeAttributes(g.source(eid))
            var n_t = g.getNodeAttributes(g.target(eid))
            var path, i, x, y, o, dpixi, lastdpixi, lasto, pixi, pi
            var edgeOpacity = (g.getEdgeAttribute(eid, 'opacity')===undefined)?(1.):(g.getEdgeAttribute(eid, 'opacity'))

            // Build path
            var d = Math.sqrt(Math.pow(n_s.x - n_t.x, 2) + Math.pow(n_s.y - n_t.y, 2))
            var angle = Math.atan2( n_t.y - n_s.y, n_t.x - n_s.x )
            var iPixStep = ns.mm_to_px(options.edge_path_segment_length)
            var segCount = Math.ceil(d/iPixStep)
            pi = 0
            path = new Int32Array(3*segCount)
            if (options.edge_curved) {
              let H = d / (2 * Math.tan(options.edge_curvature_deviation_angle))
              let offset
              for (i=0; i<1; i+=iPixStep/d) {
                offset = H * (Math.sqrt(1 - ( (1-i) * i * Math.pow(d/H,2) )) - 1)
                x = (1-i)*n_s.x + i*n_t.x - offset * Math.sin(angle)
                y = (1-i)*n_s.y + i*n_t.y + offset * Math.cos(angle)

                path[pi  ] = x*tf
                path[pi+1] = y*tf
                path[pi+2] = 255
                pi +=3
              }
            } else {
              for (i=0; i<1; i+=iPixStep/d) {
                x = (1-i)*n_s.x + i*n_t.x
                y = (1-i)*n_s.y + i*n_t.y

                path[pi  ] = x*tf
                path[pi+1] = y*tf
                path[pi+2] = 255
                pi +=3
              }
            }
            path[3*(segCount-1)  ] = n_t.x*tf
            path[3*(segCount-1)+1] = n_t.y*tf
            path[3*(segCount-1)+2] = 255

            // Compute path opacity
            if (options.edge_high_quality) {
              lastdpixi = undefined
              for (pi=0; pi<path.length; pi+=3) {
                x = path[pi  ] / tf
                y = path[pi+1] / tf

                // Opacity
                pixi = Math.floor(x*tf) + dim.w * tf * Math.floor(y*tf)
                dpixi = dPixelMap_u[pixi]
                if (dpixi === undefined) {
                  if (lastdpixi !== undefined) {
                    o = lasto
                  } else {
                    o = 0
                  }
                } else {
                  if (vidPixelMap_u[pixi] == n_s.vid || vidPixelMap_u[pixi] == n_t.vid) {
                    o = 1
                  } else {
                    o = gradient(dpixi/255)
                  }
                  if (lastdpixi === undefined && pi>3) {
                    path[(pi-3)+2] = Math.round(o*255)
                  }
                }
                path[pi+2] = Math.round(o*255)
                lastdpixi = dpixi
                lasto = o
              }

              // Smoothe path opacity
              if (path.length > 5) {
                for (i=2; i<path.length/3-2; i++) {
                  path[i*3+2] = 0.15 * path[(i-2)*3+2] + 0.25 * path[(i-1)*3+2] + 0.2 * path[i*3+2] + 0.25 * path[(i+1)*3+2] + 0.15 * path[(i+2)*3+2]
                }
              }
            }
            
            // Draw path
            var x, y, o, lastx, lasty, lasto
            for (i=0; i<path.length; i+=3) {
              x = Math.floor( 1000 * (path[i]/tf + jitter * (0.5 - Math.random())) ) / 1000
              y = Math.floor( 1000 * (path[i+1]/tf + jitter * (0.5 - Math.random())) ) / 1000
              o = path[i+2]/255

              if (lastx) {
                ctx.lineWidth = thickness * (0.9 + 0.2*Math.random())
                color.opacity = edgeOpacity*(lasto+o)/2
                ctx.beginPath()
                ctx.strokeStyle = color.toString()
                ctx.moveTo(lastx, lasty)
                ctx.lineTo(x, y)
                ctx.stroke()
                ctx.closePath()
              }

              lastx = x
              lasty = y
              lasto = o
            }
          })
      }

      ns.report("...done.")
      return ns.multiplyAlpha(
        ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height),
        options.edge_alpha
      )
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
        return ncol.toString()
      } else {
        return options.node_fill_color
      }
    }

    ns.drawNodesShadowLayer = function(options) {
      ns.log("Draw node shadows...")

      options = options || {}
      options.node_size = options.node_size || 1
      options.node_color_original = (options.node_color_original===undefined)?(false):(options.node_color_original)
      options.node_color_by_modalities = (options.node_color_by_modalities===undefined)?(false):(options.node_color_by_modalities)
      options.node_color_shadow_opacity = (options.node_color_shadow_opacity===undefined)?(.5):(options.node_color_shadow_opacity)
      options.node_color_shadow_offset = (options.node_color_shadow_offset===undefined)?(3):(options.node_color_shadow_offset) // In mm
      options.node_color_shadow_ratio = (options.node_color_shadow_ratio===undefined)?(1.5):(options.node_color_shadow_ratio)
      options.node_fill_color = options.node_fill_color || "#FFF"
      options.node_color_shadow_blur_radius = (options.node_color_shadow_blur_radius===undefined)?(3.):(options.node_color_shadow_blur_radius) // mm

      // Cache
      if (ns._nodeShadows) {
        var ctx = ns.createCanvas().getContext("2d")
        ctx.putImageData(ns._nodeShadows, 0, 0)
        // Rescale to tile
        ns.scaleContext(ctx)
        ctx.drawImage(ctx.canvas, 0, 0)
        // Final opacity adjustment (composition makes opacity = darkness)
        ns.paintAll(ctx, 'rgba(255, 255, 255, '+(1-options.node_color_shadow_opacity)+')')
        ns.report("...done.")
        return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)

      } else {

        var g = ns.g
        var ctx = ns.createCanvas().getContext("2d")

        var gradient = function(d){
          return Math.round(10000*
            (0.5 + 0.5 * Math.cos(Math.PI - Math.pow(d, 4) * Math.PI))
          )/10000
        }

        // Shadows
        var radiusRatioMax = options.node_color_shadow_ratio
        var radiusOffsetMax = ns.mm_to_px(options.node_color_shadow_offset)
        // Steps must produce sub-pixel increments even for the biggest node
        var maxNodeSize = ns.getNodeSizeExtent()[1]
        var totalSteps = Math.ceil(2 * (maxNodeSize * radiusRatioMax * options.node_size + radiusOffsetMax) * ns.settings.tile_factor)
        var steps = totalSteps

        ctx.lineCap="round"
        ctx.lineJoin="round"
        ctx.shadowColor = 'transparent'
        ctx.lineWidth = 0

        // Color
        ns.paintAll(ctx, "#FFFFFF")
        steps = totalSteps
        while (--steps>0) {
          if (steps%100 == 0) {
            ns.log2('...'+steps+' steps left in node shadows color drawing...')
          }

          var radiusRatio = 1 + (radiusRatioMax-1)*steps/totalSteps
          var radiusOffset = radiusOffsetMax*steps/totalSteps
          var progress = 1-steps/totalSteps
          var layerOpacity = gradient(progress)
          
          ns.getNodesBySize()
            .filter(nid => g.getNodeAttribute(nid, 'drawShadow')) // Custom filter
            .forEach(function(nid){
              var n = g.getNodeAttributes(nid)

              // Color
              var color = d3.color(ns.getNodeColor(options, n))

              // Tune the color to be a bit more vivid, a bit less dark
              var hsl = d3.hsl(color)
              hsl.l = Math.min(1, hsl.l * 1.2)
              hsl.s = Math.min(1, hsl.s * 1.1)

              // Bluriness (actually whiteness)
              hsl.l = (1-layerOpacity)*1 + layerOpacity*hsl.l

              color = d3.color(hsl)
              
              color.opacity = .5 // Blending

              var radius = radiusRatio * options.node_size * n.size + radiusOffset

              ctx.fillStyle = color.toString()
              ctx.beginPath()
              ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI, false)
              ctx.fill()
            })
        }

        // Blur
        if (options.node_color_shadow_blur_radius > 0) {
          var blurRadius = ns.mm_to_px(options.node_color_shadow_blur_radius)
          var imgd = ns.blur(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height), blurRadius, ctx)
          ctx.putImageData(imgd,0, 0)
        }

        ns._nodeShadows = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)

        // Rescale to tile
        ns.scaleContext(ctx)
        ctx.drawImage(ctx.canvas, 0, 0)

        // Final opacity adjustment (composition makes opacity = darkness)
        ns.paintAll(ctx, 'rgba(255, 255, 255, '+(1-options.node_color_shadow_opacity)+')')

        ns.report("...done.")
        return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
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

      var g = ns.g
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      // Node dots
      var stroke_width = ns.mm_to_px(options.node_stroke_width)

      ns.getNodesBySize()
      .filter(nid => g.getNodeAttribute(nid, 'draw'))
      .forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        var color = ns.getNodeColor(options, n)
        var radius = Math.max(options.node_size * n.size, stroke_width)

        // Custom: we add an offset to the node radius
        radius += ns.mm_to_px(0.025 /* in mm */)

        ctx.lineCap="round"
        ctx.lineJoin="round"

        if (options.node_stroke) {
          // The node stroke is in fact a bigger full circle drawn behind
          ctx.beginPath()
          ctx.arc(n.x, n.y, radius + 0.5*stroke_width, 0, 2 * Math.PI, false)
          ctx.lineWidth = 0
          ctx.fillStyle = options.node_stroke_color
          ctx.shadowColor = 'transparent'
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(n.x, n.y, radius - 0.5*stroke_width, 0, 2 * Math.PI, false)
        ctx.lineWidth = 0
        ctx.fillStyle = color.toString()
        ctx.shadowColor = 'transparent'
        ctx.fill()

      })

      ns.report("...done.")
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

    ns.drawBackgroundLayer = function(options) {

      options = options || {}
      options.background_color = options.background_color || "#FFF"

      ns.log("Draw background layer...")
      var ctx = ns.createCanvas().getContext("2d")
      ns.paintAll(ctx, options.background_color)
      ns.report("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
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

      ratio = 0.42 // CUSTOM: we fix it so that it is constant from one map to another (since this is 4K with about the same number of nodes)
      
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

    /// Connected-closeness
    ns.computeConnectedCloseness = function(options){
      // Cache
      if (ns._ccData) { return ns._ccData }

      ns.log2("Compute connected-closeness...")

      // Default options
      options = options || {}
      options.epsilon = options.epsilon || 0.03; // 3%
      options.grid_size = options.grid_size || 10; // This is an optimization thing, it's not the graphical grid
      options.random_seed = options.random_seed || 666 // Randomness is seeded for tiling consistency

      var g = ns.g

      const pairs_of_nodes_sampled = sample_pairs_of_nodes();
      const connected_pairs = g.edges().map(eid => {
        const n1 = g.getNodeAttributes(g.source(eid));
        const n2 = g.getNodeAttributes(g.target(eid));
        const d = Math.sqrt(Math.pow(n1.x-n2.x, 2)+Math.pow(n1.y-n2.y, 2));
        return d;
      })

      // Grid search for C_max
      
      let range = [0, Math.max(d3.max(pairs_of_nodes_sampled), d3.max(connected_pairs))];

      let C_max = 0;
      let distances_index = {};
      let Delta, old_C_max, C, i, target_index, indicators_over_Delta;
      do {
        for(i=0; i<=options.grid_size; i++){
          Delta = range[0] + (range[1]-range[0]) * i / options.grid_size;
          if (distances_index[Delta] === undefined) {
            distances_index[Delta] = computeIndicators(Delta, g, pairs_of_nodes_sampled, connected_pairs);
          }
        }
        old_C_max = C_max;
        C_max = 0;
        indicators_over_Delta = Object.values(distances_index);
        indicators_over_Delta.forEach((indicators, i) => {
          C = indicators.C;
          if (C > C_max) {
            C_max = C;
            target_index = i;
          }
        });
        range = [
          indicators_over_Delta[Math.max(0, target_index-1)].Delta,
          indicators_over_Delta[Math.min(indicators_over_Delta.length-1, target_index+1)].Delta
        ]
      } while ( (C_max-old_C_max)/C_max >= options.epsilon/10 )
      
      const Delta_max = find_Delta_max(indicators_over_Delta, options.epsilon);

      const indicators_of_Delta_max = computeIndicators(Delta_max, g, pairs_of_nodes_sampled, connected_pairs);
      
      ns.report2("...done.")

      // Resistance to misinterpretation
      let result
      if (indicators_of_Delta_max.C < 0.1) {
        result = {
          undefined,
          E_percent_of_Delta_max: undefined,
          p_percent_of_Delta_max: undefined,
          P_edge_of_Delta_max: undefined,
          C_max: indicators_of_Delta_max.C
        }
      } else {
        result = {
          Delta_max,
          E_percent_of_Delta_max: indicators_of_Delta_max.E_percent,
          p_percent_of_Delta_max: indicators_of_Delta_max.p_percent,
          P_edge_of_Delta_max: indicators_of_Delta_max.P_edge,
          C_max: indicators_of_Delta_max.C
        }    
      }
      ns._ccData = result
      return result

      // Internal methods

      // Bad seeded randomness
      function bsRandom() {
          var x = Math.sin(options.random_seed++) * 10000;
          return x - Math.floor(x);
      }

      // Compute indicators given a distance Delta
      function computeIndicators(Delta, g, pairs_of_nodes_sampled, connected_pairs) {
        const connected_pairs_below_Delta = connected_pairs.filter(d => d<=Delta);
        const pairs_below_Delta = pairs_of_nodes_sampled.filter(d => d<=Delta);

        // Count of edges shorter than Delta
        // note: actual count
        const E = connected_pairs_below_Delta.length;

        // Proportion of edges shorter than Delta
        // note: actual count
        const E_percent = E / connected_pairs.length;

        // Count of node pairs closer than Delta
        // note: sampling-dependent
        const p = pairs_below_Delta.length;

        // Proportion of node pairs closer than Delta
        // note: sampling-dependent, but it cancels out
        const p_percent = p / pairs_of_nodes_sampled.length;

        // Connected closeness
        const C = E_percent - p_percent;

        // Probability that, considering two nodes closer than Delta, they are connected
        // note: p is sampling-dependent, so we have to normalize it here.
        const possible_edges_per_pair = g.undirected ? 1 : 2;
        const P_edge = E / (possible_edges_per_pair * p * (g.order * (g.order-1)) / pairs_of_nodes_sampled.length);

        return {
          Delta,
          E_percent,
          p_percent,
          P_edge, // Note: P_edge is complementary information, not strictly necessary
          C
        };
      }

      function sample_pairs_of_nodes(){
        var g = ns.g
        if (g.order<2) return [];
        let samples = [];
        let node1, node2, n1, n2, d, c;
        const samples_count = g.size; // We want as many samples as edges
        if (samples_count<1) return [];
        for (let i=0; i<samples_count; i++) {
          node1 = g.nodes()[Math.floor(bsRandom()*g.order)]
          do {
            node2 = g.nodes()[Math.floor(bsRandom()*g.order)]
          } while (node1 == node2)
          n1 = g.getNodeAttributes(node1);
          n2 = g.getNodeAttributes(node2);
          d = Math.sqrt(Math.pow(n1.x-n2.x, 2)+Math.pow(n1.y-n2.y, 2));
          samples.push(d);
        }
        return samples;
      }

      function find_Delta_max(indicators_over_Delta, epsilon) {
        const C_max = d3.max(indicators_over_Delta, d => d.C);
        const Delta_max = d3.min(
            indicators_over_Delta.filter(d => (
              d.C >= (1-epsilon) * C_max
            )
          ),
          d => d.Delta
        );
        return Delta_max;
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











  /// FINALLY, RENDER
  let renderer = newRenderer()
  await renderer.renderAndSave(g, settings, thisFolder+'/VIZ TEST') // Custom
  // renderer.renderAndSaveAllTiles(g, settings)
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
  render_map_4k_no_labels(date)
}