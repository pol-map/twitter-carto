import Graph from "graphology";
import gexf from "graphology-gexf";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"
import * as d3 from 'd3';

export async function render_map_twitter(date) {
  const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
  const year = targetDate.getFullYear()
  const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const thisFolder = `data/${year}/${month}/${datem}`

  // Read file
  var gexf_string;
  try {
      gexf_string = fs.readFileSync(thisFolder+'/network_spat.gexf', 'utf8');
      // gexf_string = fs.readFileSync('data/test.gexf', 'utf8');
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
  settings.margin_top    = 12 // in mm
  settings.margin_right  = 12 // in mm
  settings.margin_bottom = 12 // in mm
  settings.margin_left   = 12 // in mm

  // Image size and resolution
  settings.image_width = 280 + settings.margin_left + settings.margin_right // in mm. Default: 200mm (fits in a A4 page)
  settings.image_height = 280 + settings.margin_top + settings.margin_bottom
  settings.output_dpi = 300 // Dots per inch.
  settings.rendering_dpi = 300 // Default: same as output_dpi. You can over- or under-render to tweak quality and speed.

  // Tiling:
  // Tiling allows to build images that would be otherwise too large.
  // You will have to assemble them by yourself.
  settings.tile_factor = 1 // Integer, default 1. Number of rows and columns of the grid of exported images.
  settings.tile_to_render = [0, 0] // Grid coordinates, as integers

  // Layers:
  // Decide which layers are drawn.
  // The settings for each layer are below.
  settings.draw_background            = true
  settings.draw_hillshading           = true
  settings.draw_network_shape_fill    = false
  settings.draw_network_shape_contour = false
  settings.draw_cluster_fills         = false
  settings.draw_cluster_contours      = false
  settings.draw_cluster_labels        = false
  settings.draw_edges                 = false
  settings.draw_node_shadows          = true
  settings.draw_nodes                 = true
  settings.draw_node_labels           = true
  settings.draw_connected_closeness   = false

  // Layer: Background
  settings.background_color = "#fafaf7"

  // Layer: Connected-closeness
  settings.cc_text_color = "#283535"
  settings.cc_text_border_color = "#fafaef"
  settings.cc_font_size = 8 // in pt
  settings.cc_line_color = "#283535"
  settings.cc_grid_line_color = "#55655e"
  settings.cc_info_margin_offset = 4.5 // In mm

  // Layer: Network shape
  //        (a potato for the whole network)
  // ...generic structure
  settings.network_shape_size = 2 // Range: more than 0, default to 1.
  settings.network_shape_smoothness = 15 // In mm (underlying blur)
  settings.network_shape_swelling = 0.95 // Range: 0.01 to 0.99 // Balanced: 0.5 // Acts on size
  // ...shape fill
  settings.network_shape_fill_alpha = 0.2 // Opacity // Range from 0 to 1
  settings.network_shape_fill_color = "#f4efec"
  // ...shape contour
  settings.network_shape_contour_thickness = 2 // Min: 1
  settings.network_shape_contour_alpha = 0.8 // Opacity // Range from 0 to 1
  settings.network_shape_contour_color = "#FFF"

  // Layer: Clusters
  //        (a potato per modality of target attribute)
  // ...generic structure
  settings.cluster_all_modalities = false // By default, we only use modalities specified in "node_clusters"
  settings.cluster_node_size_margin = 12 // In mm
  settings.cluster_shape_smoothness = 40 // In mm (underlying blur)
  settings.cluster_shape_size = 1 // Range: more than 0, default to 1.
  settings.cluster_shape_swelling = 0.75 // Range: 0.01 to 0.99 // Balanced: 0.5 // Acts on size
  // ...cluster fills
  settings.cluster_fill_alpha = 0.3 // Opacity // Range from 0 to 1
  settings.cluster_fill_color_by_modality = true // if false, use default color below
  settings.cluster_fill_color_default = "#8B8B8B"
  settings.cluster_fill_overlay = true // A different blending mode
  // ...cluster contours
  settings.cluster_contour_thickness = .3 // Range: 0 to 10 or more
  settings.cluster_contour_alpha = 1 // Opacity // Range from 0 to 1
  settings.cluster_contour_color_by_modality = true // if false, use default color below
  settings.cluster_contour_color_default = "#8B8B8B"
  // ...cluster labels
  settings.cluster_label_colored = true
  settings.cluster_label_font_min_size = 16 // In pt
  settings.cluster_label_font_max_size = 20 // In pt
  settings.cluster_label_font_thickness = .45 // In mm
  settings.cluster_label_border_thickness = 1.6 // In mm
  settings.cluster_label_inner_color = "#ffffff" // Note: here color is on the border

  // Layer: Edges
  settings.max_edge_count = Infinity
  settings.edge_thickness = 0.01 // in mm
  settings.edge_alpha = .25 // Opacity // Range from 0 to 1
  settings.edge_curved = true
  settings.edge_high_quality = true // Halo around nodes // Time-consuming
  settings.edge_color = "#6b7660"

  // Layer: Node shadows
  settings.node_color_shadow_offset = 4 // mm; larger than you'd think (gradient)
  settings.node_color_shadow_opacity = .5
  settings.node_color_shadow_blur_radius = 3 // mm

  // Layer: Nodes
  settings.adjust_voronoi_range = 100 // Factor // Larger node halo
  settings.node_size = 1. // Factor to adjust the nodes drawing size
  settings.node_color_original = true // Use the original node color
  settings.node_color_by_modalities = false // Use the modalities to color nodes (using settings.node_clusters)
  settings.node_stroke_width = 0.01 // mm
  settings.node_stroke_color = "#FFFFFF"
  settings.node_fill_color = "#283535"

  // Layer: Node labels
  settings.label_color = "#283535"
  settings.label_color_from_node = true
  settings.label_count = 80
  settings.label_max_length = 42 // Number of characters before truncate. Infinity is a valid value.
  settings.label_font_family = "Raleway"
  settings.label_font_min_size = 7.3 // in pt
  settings.label_font_max_size = 14  // in pt
  settings.label_font_thickness = .3
  settings.label_border_thickness = .7 // in mm
  settings.label_spacing_offset = 1.5 // in mm (prevents label overlap)
  settings.label_border_color = "#FFFFFF"
  settings.label_curved_path = true // Curved labels

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
  settings.heatmap_spreading = (settings.image_width - settings.margin_left - settings.margin_right) / 128 // in mm

  // Experimental stuff
  settings.hillshading_strength = 36
  settings.hillshading_color = "#1B2529"
  settings.hillshading_alpha = .36 // Opacity
  settings.hillshading_sun_azimuth = Math.PI * 0.6 // angle in radians
  settings.hillshading_sun_elevation = Math.PI * 0.35 // angle in radians
  settings.hillshading_hypsometric_gradient = true // Elevation gradient color

  /// (END OF SETTINGS)

  // Custom modifications
  const regex = /[^A-zÀ-ÿ0-9 '\-#&]*/gi;
  g.nodes().forEach(nid => {
    let n = g.getNodeAttributes(nid)
    n.label = (n.label || n.Label || '').replace(regex, '').trim()
  })
  // For shadow
  g.nodes().forEach(nid => {
    let n = g.getNodeAttributes(nid)
    n.drawShadow = n.colored == "yes"
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
      var layeredImage = ns.getEmptyLayer(true)

      // Draw background
      if (ns.settings.draw_background) {
        bgImage = ns.drawLayerOnTop(bgImage,
          ns.drawBackgroundLayer(ns.settings)
        )
      }

      // Draw Hillshading
      if (ns.settings.draw_hillshading) {
        bgImage = ns.drawLayerOnTop(bgImage,
          ns.drawHillshadingGradient(ns.settings)
        )
      }

      // Draw network shape fill
      if (ns.settings.draw_network_shape_fill) {
        bgImage = ns.drawLayerOnTop(bgImage,
          ns.drawNetworkShapeFillLayer(ns.settings)
        )
      }

      // Draw network shape contour
      if (ns.settings.draw_network_shape_contour) {
        bgImage = ns.drawLayerOnTop(layeredImage,
          ns.drawNetworkShapeContourLayer(ns.settings)
        )
      }

      // Draw node shadows
      if (ns.settings.draw_node_shadows) {
        bgImage = ns.overlayLayer(bgImage,
          ns.drawNodesShadowLayer(ns.settings),
          "multiply"
        )
      }
      
      // Draw edges
      if (ns.settings.draw_edges) {
        layeredImage = ns.drawLayerOnTop(layeredImage,
          ns.drawEdgesLayer(ns.settings)
        )
      }

      // Draw nodes
      if (ns.settings.draw_nodes) {
        layeredImage = ns.drawLayerOnTop(layeredImage,
          ns.drawNodesLayer(ns.settings)
        )
      }

      // Draw cluster contours
      if (ns.settings.draw_cluster_contours) {
        layeredImage = ns.drawLayerOnTop(layeredImage,
          ns.drawClusterContoursLayer(ns.settings)
        )
      }

      // Draw node labels
      if (ns.settings.draw_node_labels) {
        layeredImage = ns.drawLayerOnTop(layeredImage,
          ns.drawNodeLabelsLayer(ns.settings)
        )
      }

      // Draw connected-closeness
      if (ns.settings.draw_connected_closeness) {
        layeredImage = ns.overlayLayer(layeredImage,
          ns.drawConnectedClosenessGrid(ns.settings),
          "multiply"
        )
        layeredImage = ns.drawLayerOnTop(layeredImage,
          ns.drawConnectedClosenessLegend(ns.settings)
        )
      }

      // Draw cluster fills
      if (ns.settings.draw_cluster_fills) {
        if (ns.settings.cluster_fill_overlay) {
          layeredImage = ns.overlayClustersFillLayer(layeredImage, ns.settings)
        } else {
          layeredImage = ns.drawLayerOnTop(layeredImage,
            ns.drawClusterFillsLayer(ns.settings)
          )
        }
      }

      // Draw cluster labels
      if (ns.settings.draw_cluster_labels) {
        layeredImage = ns.drawLayerOnTop(layeredImage,
          ns.drawClusterLabelsLayer(ns.settings)
        )
      }

      // Merge on background
      layeredImage = ns.overlayLayer(
        bgImage,
        layeredImage,
        "multiply"
      )

      // Build final canvas
      var renderingCanvas = ns.createCanvas()
      renderingCanvas.getContext("2d").putImageData(layeredImage, 0, 0)
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

    ns.drawConnectedClosenessLegend = function(options) {
      ns.log("Draw connected-closeness legend...")

      options = options || {}
      options.C_max_threshold = options.C_max_threshold || 0.1 // Below this, CC is not applicable.
      options.cc_mention_if_not_applicable = options.cc_mention_if_not_applicable || false
      options.cc_abridged = options.cc_abridged || false
      options.cc_text_color = options.cc_text_color || "#000"
      options.cc_font_family = options.cc_font_family || "Raleway"
      options.cc_font_size = options.cc_font_size || 9 // in pt.
      options.cc_font_weight = options.cc_font_weight || 400
      options.cc_text_border_thickness = options.cc_text_border_thickness || 1.2 // in mm.
      options.cc_text_border_color = options.cc_text_border_color || "#FFF"
      options.cc_line_thickness = options.cc_line_thickness || .3 // in mm.
      options.cc_line_color = options.cc_line_color || "#000"
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
      var textThickness = ns.mm_to_px(options.cc_text_border_thickness);
      var lineThickness = ns.mm_to_px(options.cc_line_thickness);
      
      var margin_bottom = ns.mm_to_px(options.margin_bottom - options.cc_info_margin_offset)
      var margin_right  = ns.mm_to_px(options.margin_right + options.cc_info_margin_offset)
      var margin_left   = ns.mm_to_px(options.margin_left - options.cc_info_margin_offset)
      var margin_top    = ns.mm_to_px(options.margin_top + options.cc_info_margin_offset)
      var centerPoint = {x: margin_left + (dim.w-margin_left-margin_right)/2, y:margin_top + (dim.h-margin_top-margin_bottom)/2}
      var southWestPoint = {x: margin_left, y:dim.h-margin_bottom}
      var westPoint = {x: southWestPoint.x, y: centerPoint.y}
      var southPoint = {x: centerPoint.x, y:southWestPoint.y}
      var lineHeight = ns.pt_to_px(options.cc_font_size)

      if (C_max >= options.C_max_threshold) {

        // Draw the scale
        drawScaleV(ctx, westPoint.x+lineThickness/2, westPoint.y, Delta_max);
        drawText(ctx, 'Δmax', westPoint.x+lineThickness/2 + ns.mm_to_px(.5) + textThickness, westPoint.y + 0.4*ns.pt_to_px(options.cc_font_size), "start");

        drawScaleH(ctx, southPoint.x, southPoint.y-lineThickness/2, Delta_max);
        drawText(ctx, 'Δmax', southPoint.x, southPoint.y-lineThickness/2 - textThickness, "center");

        drawText(
          ctx,
          Math.round(100*ccData.E_percent_of_Delta_max)
            +(options.cc_abridged
              ? `% edges ≤ Δmax`
              : `% of connected nodes are Δmax or closer`
            ),
          southPoint.x,
          southPoint.y + 1.5*lineHeight,
          "center"
        );

        /*
        // Draw pie chart
        const chartAreaXOffset = settings.size/2 - 300 + (settings.cc_abridged ? 160 : 0)
        const pieChartR = 27;
        const pieChartCenterX = chartAreaXOffset + 25;
        const pieChartCenterY = settings.size + 55;
        drawPie(pieChartCenterX, pieChartCenterY, pieChartR);

        drawSquare(chartAreaXOffset + 67, settings.size + 35, 12, '#DDD');
        drawText(
          ctx,
          (Math.round(100*ccData.E_percent_of_Delta_max) - Math.round(100*ccData.C_max))
            +(settings.cc_abridged
              ? `% edges ≤ Δmax due to chance`
              : `% of connected nodes are closer than Δmax and would be if edges were at random`
            ),
          chartAreaXOffset + 80,
          settings.size + 40,
          "start"
        );

        drawSquare(chartAreaXOffset + 67, settings.size + 55, 12, 'rgb(49, 130, 189)');
        drawText(
          ctx,
          Math.round(100*ccData.C_max)
            +(settings.cc_abridged
              ? `% edges ≤ Δmax due to layout`
              : `% of connected nodes are closer than Δmax due to the effect of the layout`
            ),
          chartAreaXOffset + 80,
          settings.size + 60,
          "start"
        );

        drawSquare(chartAreaXOffset + 67, settings.size + 75, 12, '#FFF');
        drawText(
          ctx,
          (100-Math.round(100*ccData.C_max)-Math.round(100*ccData.E_percent_of_Delta_max)+Math.round(100*ccData.C_max))
            +(settings.cc_abridged
              ? `% edges > Δmax`
              : `% of connected nodes are more distant than Δmax`
            ),
          chartAreaXOffset + 80,
          settings.size + 80,
          "start"
        );

        drawText(
          ctx,
          settings.cc_abridged
            ? `(2 nodes ≤ Δmax) ⇒ ${Math.round(100*ccData.P_edge_of_Delta_max)}% chance connected`
            : `Two nodes closer than Δmax have a ${Math.round(100*ccData.P_edge_of_Delta_max)}% probability to be connected`
            ,
          settings.size/2,
          settings.size + 110,
          "center"
        );
        */
      } else if(options.cc_mention_if_not_applicable){
        drawText(ctx, 'Δmax is not applicable.', southPoint.x, southPoint.y + 1.5*lineHeight, "center")
      }

      ns.log("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)

      // Internal methods
      function drawText(ctx, txt, x, y, textAlign) {
        ctx.textAlign = textAlign || "start";
        ctx.font = ns.buildContextFontString(options.cc_font_weight, ns.pt_to_px(options.cc_font_size), options.cc_font_family)
        ctx.lineWidth = textThickness;
        ctx.fillStyle = options.cc_text_border_color;
        ctx.strokeStyle = options.cc_text_border_color;
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
        ctx.lineWidth = 0;
        ctx.fillStyle = options.cc_text_color;
        ctx.fillText(
          txt,
          x,
          y
        );
      }

      function drawScaleH(ctx, x, y, D) {
        const height = ns.mm_to_px(1);
        ctx.strokeStyle = options.cc_line_color;
        ctx.lineCap="round";
        ctx.lineJoin="round";
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.lineWidth = lineThickness;

        ctx.beginPath();
        ctx.moveTo(x-D/2, y-height/2)
        ctx.lineTo(x-D/2, y+height/2)
        ctx.moveTo(x-D/2, y);
        ctx.lineTo(x+D/2, y);
        ctx.moveTo(x+D/2, y-height/2)
        ctx.lineTo(x+D/2, y+height/2)
        ctx.stroke();
        ctx.closePath();
      }
    
      function drawScaleV(ctx, x, y, D) {
        const width = ns.mm_to_px(1);
        ctx.strokeStyle = options.cc_line_color;
        ctx.lineCap="round";
        ctx.lineJoin="round";
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.lineWidth = lineThickness;

        ctx.beginPath();
        ctx.moveTo(x-width/2, y-D/2)
        ctx.lineTo(x+width/2, y-D/2)
        ctx.moveTo(x, y-D/2);
        ctx.lineTo(x, y+D/2);
        ctx.moveTo(x-width/2, y+D/2)
        ctx.lineTo(x+width/2, y+D/2)
        ctx.stroke();
        ctx.closePath();
      }
    
      function drawPie(pieChartCenterX, pieChartCenterY, pieChartR) {
        drawPieSlice(pieChartCenterX, pieChartCenterY, pieChartR, 0, (ccData.E_percent_of_Delta_max-ccData.C_max), '#DDD');
        drawPieSlice(pieChartCenterX, pieChartCenterY, pieChartR, (ccData.E_percent_of_Delta_max-ccData.C_max), ccData.C_max, 'rgb(49, 130, 189)');
        drawPieSlice(pieChartCenterX, pieChartCenterY, pieChartR, (ccData.E_percent_of_Delta_max), (1-ccData.E_percent_of_Delta_max), '#FFF');

        drawPieSliceBorder(pieChartCenterX, pieChartCenterY, pieChartR, 0, (ccData.E_percent_of_Delta_max-ccData.C_max));
        drawPieSliceBorder(pieChartCenterX, pieChartCenterY, pieChartR, (ccData.E_percent_of_Delta_max-ccData.C_max), ccData.C_max);
        drawPieSliceBorder(pieChartCenterX, pieChartCenterY, pieChartR, (ccData.E_percent_of_Delta_max), (1-ccData.E_percent_of_Delta_max));

        ctx.strokeStyle = options.cc_line_color;
        ctx.lineCap="round";
        ctx.lineJoin="round";
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.lineWidth = lineThickness;
        ctx.beginPath();
        ctx.arc(pieChartCenterX, pieChartCenterY, pieChartR, 0, 2 * Math.PI);
        ctx.stroke();
      }

      function drawSquare(x, y, size, color) {
        ctx.strokeStyle = options.cc_line_color;
        ctx.lineCap="round";
        ctx.lineJoin="round";
        ctx.fillStyle = color;
        ctx.lineWidth = lineThickness;
        ctx.beginPath();
        ctx.fillRect(x-size/2, y-size/2, size, size);
        ctx.rect(x-size/2, y-size/2, size, size);
        ctx.stroke();
        ctx
      }
    
      function drawPieSlice(x, y, r, percentOffset, percent, color) {
        const startAngle = percentOffset * 2 * Math.PI - Math.PI/2;
        const endAngle = (percentOffset + percent) * 2 * Math.PI - Math.PI/2;

        ctx.strokeStyle = options.cc_line_color;
        ctx.lineCap="round";
        ctx.lineJoin="round";
        ctx.fillStyle = color;
        ctx.lineWidth = lineThickness;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, startAngle, endAngle);
        ctx.fill();
        ctx.closePath();
      }
      
      function drawPieSliceBorder(x, y, r, percentOffset, percent) {
        const startAngle = percentOffset * 2 * Math.PI - Math.PI/2;
        const endAngle = (percentOffset + percent) * 2 * Math.PI - Math.PI/2;

        ctx.strokeStyle = options.cc_line_color;
        ctx.lineCap="round";
        ctx.lineJoin="round";
        ctx.lineWidth = lineThickness;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, startAngle, endAngle);
        ctx.stroke();
        ctx.closePath();
      }
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

    ns.getClusterImprints = function() {
      if (ns._clusterImprints) {
        return ns._clusterImprints
      }

      if (!ns.settings.node_clusters || !ns.settings.node_clusters.attribute_id) {
        console.error("/!\ settings.node_clusters.attribute_id missing. Clusters cannot be computed.")
        return
      }

      var options = {}
      options.resolution_max = 100000000 // 10 megapixel
      options.node_size_margin = ns.settings.cluster_node_size_margin || 10 // In mm 
      options.node_size_factor = ns.settings.cluster_shape_size * ns.settings.node_size || 3 // above 0, default 1
      options.blur_radius = ns.settings.cluster_shape_smoothness || 5 // In mm
      options.gradient_threshold = 1-ns.settings.cluster_shape_swelling || 0.4

      var g = ns.g
      // Note we use native dimensions (not rescaled by tiles)
      // because for the tiles to join perfectly, this must be
      // computed for the whole set of tiles, i.e. on the untiled image.
      var dim = {
        w: Math.floor(ns.settings.image_width * ns.settings.rendering_dpi * 0.0393701),
        h: Math.floor(ns.settings.image_height * ns.settings.rendering_dpi * 0.0393701)
      }
      var ratio, width, height
      // Ratio
      if (dim.w*dim.h>options.resolution_max) {
        ratio = options.resolution_max/(dim.w*dim.h)
        width = Math.floor(ratio*dim.w)
        height = Math.floor(ratio*dim.h)
      } else {
        ratio = 1
        width = dim.w
        height = dim.h
      }
      console.log("Cluster imprints ratio:", ratio)

      var attId = ns.settings.node_clusters.attribute_id
      var modalities = ns.getModalities()
      var imprintsByModality = {}
      modalities.forEach(function(modality, i){
        ns.log2("Precompute cluster shape for "+modality+"...")
        
        var canvas = ns.createCanvas()
        canvas.width = width
        canvas.height = height
        var ctx = canvas.getContext("2d")
        ctx.scale(ns.settings.tile_factor, ns.settings.tile_factor)
        
        var node_margin = ns.mm_to_px(options.node_size_margin) * ratio
        g.nodes()
          .filter(function(nid){
            return g.getNodeAttribute(nid, attId) == modality
          })
          .forEach(function(nid){
            var n = g.getNodeAttributes(nid)
            var radius = node_margin + options.node_size_factor * ratio * n.size
            var nx = ratio * n.x
            var ny = ratio * n.y
            
            ctx.beginPath()
            ctx.arc(nx, ny, radius, 0, 2 * Math.PI, false)
            ctx.lineWidth = 0
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
            ctx.shadowColor = 'transparent'
            ctx.fill()
          })

        var imgd = ctx.getImageData(0, 0, width, height)

        // Blur
        var blurRadius = ns.mm_to_px(options.blur_radius) * ns.settings.tile_factor * ratio
        imgd = ns.blur(imgd, blurRadius, ctx)

        // Normalize alpha at 80% (80% normalised & 20% original)
        imgd = ns.normalizeAlpha(imgd, 0, 255, 0.8, ctx)

        // Find contour
        var values = imgd.data.filter(function(d,i){ return i%4==3 })
        var contour = d3.contours()
          .size([width, height])
          .thresholds(d3.range(0, 255))
          .contour(values, Math.round(255*options.gradient_threshold));

        // Rescale contour for tiled contexts
        contour.coordinates.forEach(poly => {
          poly.forEach(coordinates => {
            coordinates.forEach(xy => {
              xy[0] /= ns.settings.tile_factor * ratio
              xy[1] /= ns.settings.tile_factor * ratio
            })
          })
        })

        ns.report2("...done.")
        imprintsByModality[modality] = {ratio:ratio, contour:contour}
      })
      ns._clusterImprints = imprintsByModality
      return imprintsByModality
    }

    ns.drawClusterFill = function(options, modality) {
      ns.log2("Draw cluster fill for "+modality+"...")

      var clusterImprints = ns.getClusterImprints()
      
      var color
      if (options.cluster_fill_color_by_modality) {
        color = options.cluster_fill_color_default
        if (ns.settings.node_clusters.modalities[modality]) {
          color = ns.settings.node_clusters.modalities[modality].color
        }
      } else {
        color = options.cluster_fill_color_default
      }
      color = d3.color(color)
      color.opacity = options.cluster_fill_alpha

      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      var clusterImprint = clusterImprints[modality]
      
      const path = d3.geoPath(null, ctx)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.lineWidth = 0
      ctx.beginPath()
      path(clusterImprint.contour)
      ctx.fillStyle = color.toString()
      ctx.fill()

      ns.report2("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    }

    ns.overlayClustersFillLayer = function(backgroundImg, options) {
      ns.log("Overlay cluster fills...")
      
      options = options || {}
      options.cluster_fill_color_by_modality = options.cluster_fill_color_by_modality || false
      options.cluster_fill_color_default = ns.settings.node_clusters.default_color || options.cluster_fill_color_default || "#8BD"
      options.cluster_fill_alpha = options.cluster_fill_alpha || 0.3
      
      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ctx.putImageData(backgroundImg, 0, 0)
      ctx.globalCompositeOperation = "hard-light"

      var modalities = ns.getModalities()
      modalities.forEach(modality => {
        var imgd = ns.drawClusterFill(options, modality)
        var canvas2 = ns.createCanvas()
        canvas2.getContext("2d").putImageData(imgd, 0, 0)
        ctx.drawImage(canvas2, 0, 0)
      })
      ns.report("...done.")
      return ctx.getImageData(0, 0, backgroundImg.width, backgroundImg.height)
    }

    ns.drawClusterFillsLayer = function(options) {
      ns.log("Draw cluster fills...")
      
      options = options || {}
      options.cluster_fill_color_by_modality = options.cluster_fill_color_by_modality || false
      options.cluster_fill_color_default = ns.settings.node_clusters.default_color || options.cluster_fill_color_default || "#8BD"
      options.cluster_fill_alpha = options.cluster_fill_alpha || 0.3
      
      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var modalities = ns.getModalities()
      var result = ns.mergeLayers(modalities.map(modality => ns.drawClusterFill(options, modality)))
      ns.report("...done.")
      return result
    }

    ns.drawClusterContour = function(options, modality) {
      ns.log2("Draw cluster contour for "+modality+"...")

      var clusterImprints = ns.getClusterImprints()
      
      var color
      if (options.cluster_contour_color_by_modality) {
        color = options.cluster_contour_color_default
        if (ns.settings.node_clusters.modalities[modality]) {
          color = ns.settings.node_clusters.modalities[modality].color
        }
      } else {
        color = options.cluster_contour_color_default
      }
      color = d3.color(color)
      color.opacity = options.cluster_contour_alpha
      var thickness = ns.mm_to_px(options.cluster_contour_thickness)

      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      var clusterImprint = clusterImprints[modality]
      
      const path = d3.geoPath(null, ctx)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      path(clusterImprint.contour)
      ctx.lineWidth = thickness
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'
      ctx.strokeStyle = color.toString()
      ctx.stroke()

      ns.report2("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    }

    ns.drawClusterContoursLayer = function(options) {
      ns.log("Draw cluster contours...")
      
      options = options || {}
      options.cluster_contour_color_by_modality = options.cluster_contour_color_by_modality || false
      options.cluster_contour_color_default = ns.settings.node_clusters.default_color || options.cluster_contour_color_default || "#8BD"
      options.cluster_contour_alpha = options.cluster_contour_alpha || 1
      options.cluster_contour_thickness = options.cluster_contour_thickness || 1 // In mm

      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()

      var modalities = ns.getModalities()
      var result = ns.mergeLayers(modalities.map(modality => ns.drawClusterContour(options, modality)))
      ns.report("...done.")
      return result
    }

    ns.getNetworkShapeImprint = function() {
      if (ns._networkShapeImprint) {
        return ns._networkShapeImprint
      }

      ns.log2("Precompute network shape...")

      var options = {}
      options.resolution_max = 100000000 // 10 megapixel
      options.node_size_margin = 10 // In mm 
      options.node_size_factor = ns.settings.network_shape_size * ns.settings.node_size || 3 // above 0, default 1
      options.blur_radius = ns.settings.network_shape_smoothness || 5 // In mm
      options.gradient_threshold = 1-ns.settings.network_shape_swelling || 0.1
      // Process steps (edit for monitoring)
      options.step_blur = true
      options.step_save_blurred_canvas = false // For monitoring
      options.step_save_contour = false // For monitoring

      var g = ns.g
      // Note we use native dimensions (not rescaled by tiles)
      // because for the tiles to join perfectly, this must be
      // computed for the whole set of tiles, i.e. on the untiled image.
      var dim = {
        w: Math.floor(ns.settings.image_width * ns.settings.rendering_dpi * 0.0393701),
        h: Math.floor(ns.settings.image_height * ns.settings.rendering_dpi * 0.0393701)
      }
      var ratio, width, height
      // Ratio
      if (dim.w*dim.h>options.resolution_max) {
        ratio = options.resolution_max/(dim.w*dim.h)
        width = Math.floor(ratio*dim.w)
        height = Math.floor(ratio*dim.h)
      } else {
        ratio = 1
        width = dim.w
        height = dim.h
      }

      console.log("Network shape ratio:", ratio)
      
      var canvas = ns.createCanvas()
      canvas.width = width
      canvas.height = height
      var ctx = canvas.getContext("2d")
      ctx.scale(ns.settings.tile_factor, ns.settings.tile_factor)
      
      var node_margin = ns.mm_to_px(options.node_size_margin) * ratio
      g.nodes().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        var radius = node_margin + options.node_size_factor * ratio * n.size
        var nx = ratio * n.x
        var ny = ratio * n.y
        
        ctx.beginPath()
        ctx.arc(nx, ny, radius, 0, 2 * Math.PI, false)
        ctx.lineWidth = 0
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowColor = 'transparent'
        ctx.fill()
      })

      var imgd = ctx.getImageData(0, 0, width, height)

      // Blur
      if (options.step_blur) {
        // Blur
        var blurRadius = ns.mm_to_px(options.blur_radius) * ns.settings.tile_factor * ratio
        imgd = ns.blur(imgd, blurRadius, ctx)

        // Normalize alpha at 80% (80% normalised & 20% original)
        imgd = ns.normalizeAlpha(imgd, 0, 255, 0.8, ctx)

        // data to canvas
        ctx.putImageData( imgd, 0, 0 )
      }

      // SAVE PNG if necessary
      if (options.step_save_blurred_canvas) {
        var name = 'network shape monitoring'
        ns.saveCanvas(canvas, name, ()=>{console.log('The PNG file for shape monitoring was created.')})
      }

      // Find contour
      var values = imgd.data.filter(function(d,i){ return i%4==3 })
      var contour = d3.contours()
        .size([width, height])
        .thresholds(d3.range(0, 255))
        .contour(values, Math.round(255*options.gradient_threshold));

      // Rescale contour for tiled contexts
      contour.coordinates.forEach(poly => {
        poly.forEach(coordinates => {
          coordinates.forEach(xy => {
            xy[0] /= ns.settings.tile_factor * ratio
            xy[1] /= ns.settings.tile_factor * ratio
          })
        })
      })

      // SAVE PNG if necessary
      if (options.step_save_contour) {
        const path = d3.geoPath(null, ctx)
        ctx.beginPath()
        path(contour)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
        ctx.lineWidth = ns.mm_to_px(1)
        ctx.strokeStyle = "#F66"
        ctx.fill()
        ctx.stroke()

        var name = 'network shape contour monitoring'
        ns.saveCanvas(canvas, name, ()=>{console.log('The PNG file for shape contour monitoring was created.')})
      }
      
      ns.report2("...done.")
      ns._networkShapeImprint = {ratio:ratio, contour:contour}
      return ns._networkShapeImprint
    }

    ns.drawNetworkShapeContourLayer = function(options) {
      ns.log("Draw network shape (contour)...")

      options = options || {}
      options.network_shape_contour_color = options.network_shape_contour_color || "#DDD"
      options.network_shape_contour_alpha = options.network_shape_contour_alpha || .6
      options.network_shape_contour_thickness = options.network_shape_contour_thickness || 1 // in mm.

      var networkShapeImprint = ns.getNetworkShapeImprint()
      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)
      
      var color = d3.color(options.network_shape_contour_color)
      color.opacity = options.network_shape_contour_alpha
      var thickness = ns.mm_to_px(options.network_shape_contour_thickness)

      const path = d3.geoPath(null, ctx)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      path(networkShapeImprint.contour)
      ctx.lineWidth = thickness
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'
      ctx.strokeStyle = color.toString()
      ctx.stroke()

      ns.report("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    }

    ns.drawNetworkShapeFillLayer = function(options) {
      ns.log("Draw network shape (fill)...")

      options = options || {}
      options.network_shape_fill_color = options.network_shape_fill_color || "#EEE"
      options.network_shape_fill_alpha = options.network_shape_fill_alpha || .1

      var networkShapeImprint = ns.getNetworkShapeImprint()
      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)
      
      var color = d3.color(options.network_shape_fill_color)
      color.opacity = options.network_shape_fill_alpha

      const path = d3.geoPath(null, ctx)
      ctx.beginPath()
      path(networkShapeImprint.contour)
      ctx.fillStyle = color.toString()
      ctx.fill()

      ns.report("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    }

    ns.drawClusterLabelsLayer = function(options) {
      ns.log("Draw node labels...")
      
      options = options || {}
      options.cluster_label_count = options.cluster_label_count || Infinity // Only (try to) display a number of labels
      options.cluster_label_max_length = options.cluster_label_max_length || Infinity // Max characters (else an ellipsis is used)
      options.cluster_label_colored = options.cluster_label_colored || false
      options.cluster_label_inner_color = options.cluster_label_inner_color || "#FFF"
      options.cluster_label_sized = (options.cluster_label_sized===undefined)?(true):(options.cluster_label_sized)
      options.cluster_label_true_size = options.cluster_label_true_size || false // false: size adjusted to the right thickness (weight)
      options.cluster_label_font_family = options.cluster_label_font_family || 'Raleway'
      options.cluster_label_font_min_size = options.cluster_label_font_min_size || 16 // In pt
      options.cluster_label_font_max_size = options.cluster_label_font_max_size || 32 // In pt
      options.cluster_label_font_thickness = options.cluster_label_font_thickness || .6 // In mm
      options.cluster_label_border_thickness = options.cluster_label_border_thickness || 3. // In mm
      options.cluster_label_border_color = ns.settings.node_clusters.default_color || options.cluster_label_border_color || "#8BD"
      
      // Deal with font weights
      //  Relative thicknesses for: Raleway
      var weights =     [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ]
      var thicknesses = [   2, 3.5,   5,   7, 9.5,  12,  15,  18,  21 ]
      var thicknessRatio = 120
      var thicknessToWeight = d3.scaleLinear()
        .domain(thicknesses)
        .range(weights)

      // We restrain the size to the proper steps of the scale
      var text_thickness = ns.mm_to_px(options.cluster_label_font_thickness)
      var normalizeFontSize = function(size) {
        // The target thickness is the pen size, which is fixed: text_thickness
        // But to compute the weight, we must know the thickness for a standard size: 1
        var thicknessForFontSize1 = thicknessRatio * text_thickness / size
        var targetWeight = thicknessToWeight(thicknessForFontSize1)
        // console.log(size, thicknessForFontSize1, targetWeight)

        // We need to round to actual weights
        var actualWeight = Math.max(weights[0], Math.min(weights[weights.length-1], 100*Math.round(targetWeight/100)))

        // We can also restrain the size to the actual weight
        var restrainedSize = thicknessRatio * text_thickness / thicknessToWeight.invert(actualWeight)

        return [restrainedSize, actualWeight]
      }

      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      var i, x, y

      var modalities = ns.getModalities()
      var clusterImprints = ns.getClusterImprints()
      var nodeCountByModality = {}
      modalities.forEach(m => {nodeCountByModality[m] = 0})
      g.nodes().forEach(nid => {
        nodeCountByModality[g.getNodeAttribute(nid, ns.settings.node_clusters.attribute_id)]++
      })
      // Compute scale for labels
      var label_clusterSizeExtent = [0, d3.max(Object.values(nodeCountByModality))]

      // Draw labels
      var labelsStack = []
      var borderThickness = ns.mm_to_px(options.cluster_label_border_thickness)
      modalities.forEach(function(modality){

        var path = d3.geoPath()
        var centroid = path.centroid(clusterImprints[modality].contour)
        
        var color
        if (options.cluster_label_colored) {
          color = options.cluster_label_border_color
          if (ns.settings.node_clusters.modalities[modality]) {
            color = ns.settings.node_clusters.modalities[modality].color
          }
        } else {
          color = options.cluster_label_border_color
        }
        color = d3.color(color)

        // Precompute the label
        var count = nodeCountByModality[modality]
        var fontSize = ns.pt_to_px( options.cluster_label_sized
          ? Math.floor(options.cluster_label_font_min_size + (count - label_clusterSizeExtent[0]) * (options.cluster_label_font_max_size - options.cluster_label_font_min_size) / (label_clusterSizeExtent[1] - label_clusterSizeExtent[0]))
          : Math.floor(0.8 * options.cluster_label_font_min_size + 0.2 * options.cluster_label_font_max_size)
        )
        
        // sw: Size and weight
        var sw = normalizeFontSize(fontSize)
        if (!options.cluster_label_true_size) {
          fontSize = sw[0]
        }
        var fontWeight = sw[1]
        ctx.font = ns.buildContextFontString(fontWeight, fontSize, options.cluster_label_font_family)

        // Then, draw the label only if wanted
        var labelCoordinates = {
          x: centroid[0],
          y: centroid[1] + 0.25 * fontSize
        }

        var label = ns.truncateWithEllipsis(ns.settings.node_clusters.modalities[modality].label.replace(/^https*:\/\/(www\.)*/gi, ''), options.cluster_label_max_length)

        // Add to draw pipe
        var l = {
          label: label,
          x: labelCoordinates.x,
          y: labelCoordinates.y,
          font: ctx.font,
          color: color
        }
        labelsStack.push(l)
      })
      
      // Draw borders
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.textAlign = "center"
      labelsStack.forEach(function(l){
        ctx.font = l.font
        ctx.lineWidth = borderThickness
        ctx.fillStyle = l.color.toString()
        ctx.strokeStyle = l.color.toString()
        ctx.fillText(
          l.label
        , l.x
        , l.y
        )
        ctx.strokeText(
          l.label
        , l.x
        , l.y
        )
      })

      // Draw text
      labelsStack.forEach(function(l){
        ctx.font = l.font
        ctx.lineWidth = 0
        ctx.fillStyle = options.cluster_label_inner_color
        ctx.fillText(
          l.label
        , l.x
        , l.y
        )
      })

      ns.report("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    }

    ns.getNormalizeFontSize = function(options, bolder) {
      options = options || {}
      options.label_font_thickness = options.label_font_thickness || .3 // In mm

      // Deal with font weights
      //  Relative thicknesses for: Raleway
      var weights =     [ 100, 200, 300, 400, 500, 600, 700, 800, 900 ]
      var thicknesses = [   2, 3.5,   5,   7, 9.5,  12,  15,  18,  21 ]
      var thicknessRatio = 120
      var thicknessToWeight = d3.scaleLinear()
        .domain(thicknesses)
        .range(weights)

      // We restrain the size to the proper steps of the scale
      var text_thickness = ns.mm_to_px(options.label_font_thickness)

      // Custom: bolder
      if (bolder) {
        text_thickness *= 2
      }

      var normalizeFontSize = function(size) {
        // The target thickness is the pen size, which is fixed: text_thickness
        // But to compute the weight, we must know the thickness for a standard size: 1
        var thicknessForFontSize1 = thicknessRatio * text_thickness / size
        var targetWeight = thicknessToWeight(thicknessForFontSize1)
        // console.log(size, thicknessForFontSize1, targetWeight)

        // We need to round to actual weights
        var actualWeight = Math.max(weights[0], Math.min(weights[weights.length-1], 100*Math.round(targetWeight/100)))

        // We can also restrain the size to the actual weight
        var restrainedSize = thicknessRatio * text_thickness / thicknessToWeight.invert(actualWeight)

        return [restrainedSize, actualWeight]
      }

      return normalizeFontSize
    }

    ns.tuneColorForLabel = function(c) {
      var options = {}
      options.label_color_min_C = 0
      options.label_color_max_C = 70
      options.label_color_min_L = 2
      options.label_color_max_L = 50
      var hcl = d3.hcl(c)
      hcl.c = Math.max(hcl.c, options.label_color_min_C)
      hcl.c = Math.min(hcl.c, options.label_color_max_C)
      hcl.l = Math.max(hcl.l, options.label_color_min_L)
      hcl.l = Math.min(hcl.l, options.label_color_max_L)
      return d3.color(hcl)
    }

    ns.drawNodeLabelsLayer = function(options) {
      ns.log("Draw node labels...")
      
      options = options || {}
      options.label_count = options.label_count || Infinity // Only (try to) display a number of labels
      options.label_max_length = options.label_max_length || Infinity // Max characters (else an ellipsis is used)
      options.colored_labels = (options.colored_labels===undefined)?(true):(options.colored_labels)
      options.label_color = options.label_color || "#000"
      options.label_color_from_node = (options.label_color_from_node===undefined)?(true):(options.label_color_from_node)
      options.sized_labels = (options.sized_labels===undefined)?(true):(options.sized_labels)
      options.node_size = options.node_size || 1 // A scaling factor
      options.label_true_size = options.label_true_size || false // false: size adjusted to the right thickness (weight)
      options.label_spacing_factor = options.label_spacing_factor || 1 // 1=normal; 2=box twice as wide/high etc.
      options.label_spacing_offset = options.label_spacing_offset || 1 // In mm
      options.label_font_family = options.label_font_family || 'Raleway'
      options.label_font_min_size = options.label_font_min_size || 7 // In pt
      options.label_font_max_size = options.label_font_max_size || 14 // In pt
      options.label_font_thickness = options.label_font_thickness || .3 // In mm
      options.label_border_thickness = (options.label_border_thickness===undefined)?(1.):(options.label_border_thickness) // In mm
      options.label_border_color = options.label_border_color || "#FFF"
      options.label_curved_path = (options.label_curved_path===undefined)?(false):(options.label_curved_path)
      options.label_path_step = .5; // In mm
      options.label_path_downhill = true
      options.label_path_center = false
      options.label_path_starting_angle_range = Math.PI/2 // From 0 (horizontal) to PI (any angle)
      options.label_path_step_angle_range = 0.33 // Curvature per font size. 0 is straight.

      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      var i, x, y

      // Get visible labels
      //var normalizeFontSize = ns.getNormalizeFontSize(options)
      var visibleLabels = ns.getVisibleLabels(options)

      // Draw labels
      var labelsStack = []
      var borderThickness = ns.mm_to_px(options.label_border_thickness)
      var labelPaths = (options.label_curved_path)?(ns.getLabelPaths(options)):(false)
      let drawnMinFontSize = Infinity
      visibleLabels.forEach(function(nid){

        var n = g.getNodeAttributes(nid)
        var nx = n.x
        var ny = n.y

        var color
        if (options.label_color_from_node) {
          color = ns.tuneColorForLabel(ns.getNodeColor(options, n))
        } else {
          color = d3.color(options.label_color)
        }

        // Precompute the label
        ctx.font = ns.buildLabelFontContext(options, n.size, n.important) // Custom: important
        var fontSize = +ctx.font.split('px')[0]
        if (!isNaN(fontSize)) {
          drawnMinFontSize = Math.min(drawnMinFontSize, fontSize)
        }

        // Then, draw the label only if wanted
        var radius = Math.max(options.node_size * n.size, 2)
        var labelCoordinates = {
          x: nx,
          y: ny + 0.25 * fontSize
        }

        var label = ns.tuneLabelString(n.label, options)

        // Add to draw pipe
        var l = {
          label: label,
          x: labelCoordinates.x,
          y: labelCoordinates.y,
          path: ((options.label_curved_path)?(labelPaths[nid]):(false)),
          font: ctx.font,
          color: color
        }
        labelsStack.push(l)
      })
      
      ctx.textAlign = "center"
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      // Draw borders
      if (borderThickness > 0) {
        labelsStack.forEach(function(l){
          ctx.font = l.font
          ctx.lineWidth = borderThickness
          ctx.fillStyle = options.label_border_color
          ctx.strokeStyle = options.label_border_color

          if (options.label_curved_path) {
            ns.drawTextPath(ctx, l.path, l.label, true)
          } else {
            ctx.fillText(
              l.label
            , l.x
            , l.y
            )
            ctx.strokeText(
              l.label
            , l.x
            , l.y
            )
          }
        })
      }

      // Draw text
      labelsStack.forEach(function(l){
        ctx.font = l.font
        ctx.lineWidth = 0
        ctx.fillStyle = l.color.toString()
        if (options.label_curved_path) {
          ns.drawTextPath(ctx, l.path, l.label)
        } else {
          ctx.fillText(
            l.label
          , l.x
          , l.y
          )
        }
      })

      console.log("FONT SIZE MIN (DRAWN) (pt): ", ns.px_to_pt(drawnMinFontSize))
      ns.report("...done.")
      return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
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

    ns.buildLabelFontContext = function(options, node_size, bolder) { // Custom: bolder
      var nodeSizeExtent = ns.getNodeSizeExtent()
      var fontSize = ns.pt_to_px( options.sized_labels
        ? Math.floor(options.label_font_min_size + (node_size - nodeSizeExtent[0]) * (options.label_font_max_size - options.label_font_min_size) / (nodeSizeExtent[1] - nodeSizeExtent[0]))
        : Math.floor(0.8 * options.label_font_min_size + 0.2 * options.label_font_max_size)
      )
      
      // sw: Size and weight
      var normalizeFontSize = ns.getNormalizeFontSize(options, bolder) // Custom: bolder
      var sw = normalizeFontSize(fontSize)
      if (!options.true_size) {
        fontSize = sw[0]
      }
      var fontWeight = sw[1]

      return ns.buildContextFontString(fontWeight, fontSize, options.label_font_family)
    }

    ns.getTextPathMeasureText = function(ctx) {
      return function(text) {
        return ctx.measureText(text).width;
      }
    }

    ns.getTextPathDraw = function(ctx, useBorder) {
      if (useBorder) {
        return function(letter, x, y, angle) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.translate(0, 0.2 * ctx.font.split('px')[0]);
          ctx.fillText(letter, 0, 0);
          ctx.strokeText(letter, 0, 0);
          ctx.restore();
        }
      } else {
        return function(letter, x, y, angle) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.translate(0, 0.2 * ctx.font.split('px')[0]);
          ctx.fillText(letter, 0, 0);
          ctx.restore();
        }
      }
    }

    ns.getLabelPaths = function(options) {
      options = options || {}
      // For monitoring only
      options.label_path_monitor_field = false
      options.label_path_monitor = false
      options.node_size = (options.node_size===undefined)?(1):(options.node_size)
      options.label_node_space_ratio = 0.08 // ratio of node size

      // Cache
      if (ns._labelPaths) {
        return ns._labelPaths
      }

      ns.log2("Precompute the paths of node labels...")

      var labelPaths = {}
      var g = ns.g
      var dim = ns.getRenderingPixelDimensions()
      var ctx = ns.createCanvas().getContext("2d")
      ns.scaleContext(ctx)

      // Prepare text path draw functions
      var textPath_measureText = ns.getTextPathMeasureText(ctx)
      var textPath_draw = ns.getTextPathDraw(ctx)

      /// Unpack hillshading data
      var shadingData = ns.getHillshadingData()

      // Unpack hillshading
      var ratio = 1/shadingData.ratio
      var lPixelMap = new Float64Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
      var hPixelMap = new Float64Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
      var dxPixelMap = new Float64Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
      var dyPixelMap = new Float64Array(dim.w * dim.h * ns.settings.tile_factor * ns.settings.tile_factor)
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
        hPixelMap[i] =
            (1-dx) * (
              (1-dy) * shadingData.hPixelMap[ip_top_left]
              +  dy  * shadingData.hPixelMap[ip_bottom_left]
            )
          + dx * (
              (1-dy) * shadingData.hPixelMap[ip_top_right]
              +  dy  * shadingData.hPixelMap[ip_bottom_right]
            )
        dxPixelMap[i] =
            (1-dx) * (
              (1-dy) * shadingData.dxPixelMap[ip_top_left]
              +  dy  * shadingData.dxPixelMap[ip_bottom_left]
            )
          + dx * (
              (1-dy) * shadingData.dxPixelMap[ip_top_right]
              +  dy  * shadingData.dxPixelMap[ip_bottom_right]
            )
        dyPixelMap[i] =
            (1-dx) * (
              (1-dy) * shadingData.dyPixelMap[ip_top_left]
              +  dy  * shadingData.dyPixelMap[ip_bottom_left]
            )
          + dx * (
              (1-dy) * shadingData.dyPixelMap[ip_top_right]
              +  dy  * shadingData.dyPixelMap[ip_bottom_right]
            )
      }

      const xOffset = -dim.w*ns.settings.tile_to_render[0]
      const yOffset = -dim.h*ns.settings.tile_to_render[1]
      if (options.label_path_monitor_field) {
        ns.log2("Draw Shading field (for monitoring)...")
        let shData = new Uint8ClampedArray(dim.w * dim.h * 4)
        hPixelMap.forEach((h,i) => {
          let x = i%(dim.w*ns.settings.tile_factor)
          let y = (i-x)/(dim.w*ns.settings.tile_factor)
          let X = x + xOffset
          let Y = y + yOffset
          var dx = dxPixelMap[i]
          var dy = dyPixelMap[i]
          var d = Math.sqrt( Math.pow(dx, 2) + Math.pow(dy, 2) )
          dx /= d
          dy /= d
          if (0 <= X && X <= dim.w && 0 <= Y && Y <= dim.h) {
            let I = X + Y*dim.w
            shData[4*I  ] = Math.floor(255*(0.5+dx/2))
            shData[4*I+1] = Math.floor(255*(0.5+dy/2))
            shData[4*I+2] = Math.floor(255*(hPixelMap[i]))
            shData[4*I+3] = 255
          }
        })
        let shImgd = new ImageData(shData, dim.w, dim.h)
        ctx.putImageData(shImgd,0, 0)

        // Control dots (it's a different logic)
        var dots = 10000
        while (dots-->0) {
          // Random control dots
          var x = Math.random()*dim.w
          var y = Math.random()*dim.h
          var i = Math.floor(x*settings.tile_factor) + Math.floor(y*settings.tile_factor)*dim.w*ns.settings.tile_factor
          var angle = Math.atan2(dyPixelMap[i], dxPixelMap[i])
          var dx = Math.cos(angle)
          var dy = Math.sin(angle)

          var color = d3.color("#000000")
          color.r = Math.floor(255*(0.5+dx/2))
          color.g = Math.floor(255*(0.5+dy/2))
          color.opacity = 1
          
          ctx.fillStyle = color.toString()
          ctx.beginPath();
          ctx.arc(x, y, 2.75, 0, 2 * Math.PI);
          ctx.fill();
        }

        ns.report2("...done.")
      }

      // Compute each label's path
      var step_length = ns.mm_to_px(options.label_path_step);
      g.nodes().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        var nx = n.x
        var ny = n.y
        var nodeSize = options.node_size * n.size
        var labelOffset = nodeSize * (1+options.label_node_space_ratio)

        if (options.label_path_monitor) {
          ctx.fillStyle = "#FFFFFF"
          ctx.beginPath();
          ctx.arc(nx, ny, 2.5, 0, 2 * Math.PI);
          ctx.fill();
        }

        var label = ns.tuneLabelString(n.label, options)
        ctx.font = ns.buildLabelFontContext(options, n.size, n.important) // Custom: important
        let fontSize = +ctx.font.replace('bold ', '').split('px')[0]
        let maxCurvature = options.label_path_step_angle_range / ns.px_to_pt(fontSize)

        // Let's get the label length
        var labelLength = ctx.measureText(label).width

        // For simplicity, the path always has a "central" segment
        var originalAngle, angle
        var path = []
        var pathLength = 0
        // Set the central segment
        var i = Math.floor(nx*settings.tile_factor) + Math.floor(ny*settings.tile_factor)*dim.w*ns.settings.tile_factor
        originalAngle = Math.atan2(dyPixelMap[i], dxPixelMap[i])
        if (n.labelStartAngle !== undefined) {
          angle = -n.labelStartAngle // The minus sign is to stick to the trigonometric convention for the label
        } else {
          if (options.label_path_downhill) {
            angle = Math.atan2(dyPixelMap[i], dxPixelMap[i])
          } else {
            angle = Math.atan2(dxPixelMap[i], -dyPixelMap[i])
          }
          // Note: angle is in [-PI, PI] at this stage
          if (Math.PI/2 < angle && angle < Math.PI - options.label_path_starting_angle_range/2) {
            angle = Math.PI - options.label_path_starting_angle_range/2
          } else if (options.label_path_starting_angle_range/2 < angle && angle < Math.PI/2 ) {
            angle = options.label_path_starting_angle_range/2
          } else if (-Math.PI/2 < angle && angle < -options.label_path_starting_angle_range/2 ) {
            angle = -options.label_path_starting_angle_range/2
          } else if (-Math.PI + options.label_path_starting_angle_range/2 < angle && angle < -Math.PI/2 ) {
            angle = -Math.PI + options.label_path_starting_angle_range/2
          }
        }

        var initAngle = angle
        var lastAngle = angle
        path.push([nx - 0.5*step_length*Math.cos(angle), ny - 0.5*step_length*Math.sin(angle), originalAngle])
        path.push([nx + 0.5*step_length*Math.cos(angle), ny + 0.5*step_length*Math.sin(angle), originalAngle])
        pathLength += step_length
        var point
        
        // Extend the path forward (to the right)
        while (pathLength < ((options.label_path_center)?(labelLength/2):(labelLength+labelOffset))) {
          point = path[path.length - 1]
          i = Math.floor(point[0]*settings.tile_factor) + Math.floor(point[1]*settings.tile_factor)*dim.w*ns.settings.tile_factor
          originalAngle = Math.atan2(dyPixelMap[i], dxPixelMap[i])
          if (options.label_path_downhill) {
            angle = Math.atan2(dyPixelMap[i], dxPixelMap[i])
          } else {
            angle = Math.atan2(dxPixelMap[i], -dyPixelMap[i])
          }
          let angleDiff = angle-lastAngle
          while (angleDiff <= -Math.PI) {
            angleDiff += 2*Math.PI
          }
          while (angleDiff > Math.PI) {
            angleDiff -= 2*Math.PI
          }
          if (angleDiff > maxCurvature) {
            angleDiff = maxCurvature
          } else if (angleDiff < -maxCurvature) {
            angleDiff = -maxCurvature
          }
          angle = lastAngle + angleDiff
          path.push([point[0]+step_length*Math.cos(angle), point[1]+step_length*Math.sin(angle), originalAngle])
          lastAngle = angle
          pathLength += step_length
        }

        if (options.label_path_center) {
          lastAngle = initAngle
          // Extend the path backwards (to the left)
          while (pathLength < labelLength) {
            point = path[0]
            i = Math.floor(point[0]*settings.tile_factor) + Math.floor(point[1]*settings.tile_factor)*dim.w*ns.settings.tile_factor
            originalAngle = Math.atan2(dyPixelMap[i], dxPixelMap[i])
            if (options.label_path_downhill) {
              angle = Math.atan2(dyPixelMap[i], dxPixelMap[i])
            } else {
              angle = Math.atan2(dxPixelMap[i], -dyPixelMap[i])
            }
            let angleDiff = angle-lastAngle
            while (angleDiff <= -Math.PI) {
              angleDiff += 2*Math.PI
            }
            while (angleDiff > Math.PI) {
              angleDiff -= 2*Math.PI
            }
            if (angleDiff > maxCurvature) {
              angleDiff = maxCurvature
            } else if (angleDiff < -maxCurvature) {
              angleDiff = -maxCurvature
            }
            angle = lastAngle + angleDiff
            path.unshift([point[0]-step_length*Math.cos(angle), point[1]-step_length*Math.sin(angle), originalAngle])
            lastAngle = angle
            pathLength += step_length
          }
        } else {
          // We need to remove the some length at the beginning where it overlaps the node
          while (pathLength>=labelLength) {
            path.shift()
            pathLength -= step_length
          }
        }
        labelPaths[nid] = path

        if (options.label_path_monitor) {
          path.forEach(p => {
            ctx.fillStyle = "#FFFFFF"
            ctx.beginPath();
            ctx.arc(p[0], p[1], 2, 0, 2 * Math.PI);
            ctx.fill();
            var dx = Math.cos(p[2])
            var dy = Math.sin(p[2])
            var color = d3.color("#000000")
            color.r = Math.floor(255*(0.5+dx/2))
            color.g = Math.floor(255*(0.5+dy/2))
            color.opacity = 1
            ctx.fillStyle = color.toString()
            ctx.beginPath();
            ctx.arc(p[0], p[1], 1.75, 0, 2 * Math.PI);
            ctx.fill();
          })
        }
      })

      if (options.label_path_monitor || options.label_path_monitor_field) {
        ns.downloadImageData(ctx.getImageData(0, 0, dim.w, dim.h), 'Shading field monitoring')
      }

      ns.report2("...done.")
      ns._labelPaths = labelPaths
      return labelPaths
    }

    ns.drawTextPath = function(ctx, path, label, useBorder) {
      let textPath_measureText = ns.getTextPathMeasureText(ctx)
      let textPath_draw = ns.getTextPathDraw(ctx, useBorder)
      try {
        ns.textPath(label, path, textPath_measureText, textPath_draw, 'center');
      } catch(e) {
        console.warn('Text path could not be drawn for label "'+label+'"')
      }
    }

    ns.getVisibleLabels = function(options) {
      // Cache
      if (ns._visibleLabels) {
        return ns._visibleLabels
      }

      options = options || {}
      options.label_collision_pixmap_max_resolution = options.label_collision_pixmap_max_resolution || 10000000 // 10 megapixel
      options.label_collision_include_node = true
      // For monitoring
      options.download_image = false // For monitoring the process

      ns.log2("Precompute visible node labels...")

      var i, x, y, visibleLabels = []
      var dim = ns.getRenderingPixelDimensions()
      var g = ns.g
      var labelPaths = ((options.label_curved_path)?(ns.getLabelPaths(options)):(false))

      // Reverse nodes by size order
      var nodesBySize = ns.getNodesBySize().slice(0)
      nodesBySize.reverse()

      // Ratio
      var ratio, width, height
      if (dim.w*dim.h>options.label_collision_pixmap_max_resolution) {
        ratio = Math.sqrt(options.label_collision_pixmap_max_resolution/(dim.w*dim.h))
        width = Math.floor(ratio*dim.w)
        height = Math.floor(ratio*dim.h)
      } else {
        ratio = 1
        width = dim.w
        height = dim.h
      }
      console.log("Label collision map ratio:",ratio,"- Dimensions: "+width+" x "+height)

      var ctx = ns.createCanvas().getContext("2d")
      ctx.canvas.width = width
      ctx.canvas.height = height
      ctx.scale(ratio, ratio)
      // Paint all white
      ctx.beginPath()
      ctx.rect(0, 0, dim.w, dim.h)
      ctx.fillStyle = "#000"
      ctx.fill()
      ctx.closePath()

      // Evaluate labels
      var labelDrawCount = options.label_count
      var offset = ns.mm_to_px(options.label_spacing_offset)
      var stroke_width = ns.mm_to_px(options.node_stroke_width || 0)
      var count = 0
      nodesBySize
      .forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        if (labelDrawCount > 0 || n.important) { // Custom: important
          var nx = n.x
          var ny = n.y

          ctx.font = ns.buildLabelFontContext(options, n.size, n.important) // Custom: important
          var fontSize = +ctx.font.replace('bold ', '').split('px')[0]
          var label = ns.tuneLabelString(n.label, options)

          // Create new empty canvas for the bounding area of that label
          var ctx2 = ns.createCanvas().getContext("2d")
          ctx2.canvas.width = width
          ctx2.canvas.height = height
          ctx2.scale(ratio, ratio)
          // Paint all white
          ctx2.beginPath()
          ctx2.rect(0, 0, dim.w, dim.h)
          ctx2.fillStyle = "#000"
          ctx2.fill()
          ctx2.closePath()

          // Draw the bounding area on that canvas
          var path
          if (options.label_curved_path) {
            path = labelPaths[nid]
          } else {
            // Here the path is basically just the dimensions of the label
            var measure = ctx.measureText(label)
            // Assuming centered label
            path = [
              [nx - measure.width/2, ny - 0.25*fontSize],
              [nx + measure.width/2, ny - 0.25*fontSize]
            ]
          }
          if (path.length > 0) {
            var margin = (fontSize * options.label_spacing_factor - fontSize)/2 + offset
            var lineWidth = fontSize + 2*margin
            ctx2.strokeStyle = '#FFF'
            ctx2.lineCap = 'round';
            ctx2.lineJoin = 'round';
            ctx2.lineWidth = lineWidth;
            var pathxmin = dim.w
            var pathxmax = 0
            var pathymin = dim.h
            var pathymax = 0
            ctx2.beginPath()
            var x, y
            x = path[0][0]
            y = path[0][1]
            ctx2.moveTo(x, y)
            pathxmin = Math.min(pathxmin, x)
            pathxmax = Math.max(pathxmax, x)
            pathymin = Math.min(pathymin, y)
            pathymax = Math.max(pathymax, y)
            for (let pi=1; pi<path.length; pi++){
              x = path[pi][0]
              y = path[pi][1]
              ctx2.lineTo(x, y)
              pathxmin = Math.min(pathxmin, x)
              pathxmax = Math.max(pathxmax, x)
              pathymin = Math.min(pathymin, y)
              pathymax = Math.max(pathymax, y)
            }
            ctx2.stroke()

            // Merge with the other canvas
            ctx2.globalCompositeOperation = "multiply"
            ctx2.setTransform(1, 0, 0, 1, 0, 0);
            ctx2.drawImage(ctx.canvas, 0, 0)
            ctx2.scale(ratio, ratio)
    
            // Test bounding box collision
            var collision = false
            var box = {
              x: Math.max(0, pathxmin-lineWidth/2),
              y: Math.max(0, pathymin-lineWidth/2),
              w: Math.min(width , pathxmax-pathxmin + lineWidth),
              h: Math.min(height, pathymax-pathymin + lineWidth)
            }
            if (!isNaN(box.w) && !isNaN(box.h) && box.w>0 && box.h>0) {
              var imgd = ctx2.getImageData(
                Math.floor(ratio*box.x),
                Math.floor(ratio*box.y),
                Math.ceil(ratio*box.w),
                Math.ceil(ratio*box.h)
              )
              var data = imgd.data
              for (let i = 0; i < data.length; i += 4) {
                if (data[i] > 0) {
                  collision = true
                  break
                }
              }
            } else {
              collision = true
              console.log("Warning: path issue for "+nid+" ("+label+"):", box)
            }
          } else {
            collision = true
            // console.log("Warning: path of length 0 for "+nid+" ("+label+"):")
          }

          if (!collision || n.important) { // Custom: important
            // Draw the bounding area on that canvas
            ctx.strokeStyle = '#FFF'
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = fontSize + 2*margin;
            ctx.beginPath()
            var x, y
            x = path[0][0]
            y = path[0][1]
            ctx.moveTo(x, y)
            for (let pi=1; pi<path.length; pi++){
              x = path[pi][0]
              y = path[pi][1]
              ctx.lineTo(x, y)
            }
            ctx.stroke()

            // Draw the node itself if needed
            if (options.label_collision_include_node) {
              var radius = Math.max(options.node_size * n.size, stroke_width)
              ctx.beginPath()
              ctx.arc(n.x, n.y, radius - 0.5*stroke_width, 0, 2 * Math.PI, false)
              ctx.lineWidth = 0
              ctx.fillStyle = '#FFF'
              ctx.fill()
            }

            // Update count
            labelDrawCount--
            if (labelDrawCount%100 == 0) {
              ns.log2('...'+labelDrawCount+' displayable labels to find...')
            }

            // Add to draw pipe
            visibleLabels.push(nid)

            if (options.download_image) {
              // Draw bounding area rectangle
              ctx.beginPath();
              ctx.lineWidth = 1;
              ctx.strokeStyle = '#0FF';
              ctx.rect(box.x, box.y, box.w, box.h)
              ctx.stroke();
    
              // Draw label
              ctx.lineWidth = 0
              ctx.fillStyle = '#F00'
              ctx.textAlign = 'center'
              
              if (options.label_curved_path) {
                ns.drawTextPath(ctx, path, label)
              } else {
                ctx.fillText(
                  label,
                  nx,
                  ny
                )
              }
            }
          }

          if (++count%100==0) {
            ns.log2('...'+count+' labels evaluated...')
          }
        }
      })

      if (options.download_image) {
        var imgd = ctx.getImageData(0, 0, width, height)
        ns.downloadImageData(imgd, 'Labels monitoring')
      }
      
      ns.report2("...done.")
      ns._visibleLabels = visibleLabels
      return visibleLabels
    }

    ns.tuneLabelString = function(label, options) {
      options = options || {}
      options.label_max_length = options.label_max_length || Infinity
      return ns.truncateWithEllipsis(label.replace(/^https*:\/\/(www\.)*/gi, ''), options.label_max_length)
    }

    ns.truncateWithEllipsis = function(string, n) {
      if (n && n<Infinity) return string.substr(0,n-1)+(string.length>n?'…':'');
      return string
    }

    ns.buildContextFontString = function(fontWeight, fontSize, fontFamily) {
      // Normalize font size
      fontSize = Math.floor(1000 * fontSize)/1000
      let weightSuffix
      fontWeight = +fontWeight
      switch (fontWeight) {
        case 100:
          weightSuffix = " Thin"
          break
        case 200:
          weightSuffix = " ExtraLight"
          break
        case 300:
          weightSuffix = " Light"
          break
        case 400:
          weightSuffix = ""
          break
        case 500:
          weightSuffix = " Medium"
          break
        case 600:
          weightSuffix = " SemiBold"
          break
        case 700:
          return "bold " + fontSize + "px '" + fontFamily + "', sans-serif"
          break
        case 800:
          weightSuffix = " ExtraBold"
          break
        case 900:
          weightSuffix = " Black"
          break
      }
      //return fontSize + "px " + fontFamily + weightSuffix
      return fontSize + "px '" + fontFamily + weightSuffix + "', sans-serif"
    }

    // TextPath
    // From https://www.npmjs.com/package/textpath
    ns.textPath = function(text, path, measure, draw, textAlign) {
      var pathLength = 0;
      var p1 = path[0]
      for (var i = 1, ii = path.length; i < ii; ++i) {
        var p2 = path[i];
        pathLength += Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
        p1 = p2;
      }
      var textLength = measure(text);
      var align = textAlign == 'left' ? 0 : textAlign == 'right' ? 1 : 0.5;
      var startM = (pathLength - textLength) * align;
      var offset = 0;
      var end = path.length;

      // Keep text upright
      var reverse = path[offset][0] > path[end - 1][0];

      var numChars = text.length;

      var x1 = path[offset][0];
      var y1 = path[offset][1];
      offset += 1;
      var x2 = path[offset][0];
      var y2 = path[offset][1];
      var segmentM = 0;
      var segmentLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

      var index;
      for (var i = 0; i < numChars; ++i) {
        index = reverse ? numChars - i - 1 : i;
        var char = text[index];
        var charLength = measure(char);
        var charM = startM + charLength / 2;
        while (offset < end - 1 && segmentM + segmentLength < charM) {
          x1 = x2;
          y1 = y2;
          offset += 1;
          x2 = path[offset][0];
          y2 = path[offset][1];
          segmentM += segmentLength;
          segmentLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        }
        var segmentPos = charM - segmentM;
        var angle = Math.atan2(y2 - y1, x2 - x1);
        if (reverse) {
          angle += angle > 0 ? -Math.PI : Math.PI;
        }
        var interpolate = segmentPos / segmentLength;
        var x = x1 + interpolate * (x2 - x1);
        var y = y1 + interpolate * (y2 - y1);
        draw(char, x, y, angle);
        startM += charLength;
      }
    }
    /*ns.textPath = function(t) {
      function r(a) {
        if (e[a]) return e[a].exports;
        var n=e[a]={i:a,l:!1,exports:{}};
        return t[a].call(n.exports,n,n.exports,r),n.l=!0,n.exports
      }
      var e={};
      return r.m=t,r.c=e,r.d=function(t,e,a){
        r.o(t,e) || Object.defineProperty(t,e,{configurable:!1,enumerable:!0,get:a})
      },r.n=function(t){
        var e=t&&t.__esModule?function(){
          return t.default
        }:function(){return t};
        return r.d(e,"a",e),e
      },r.o=function(t,r){
        return Object.prototype.hasOwnProperty.call(t,r)
      },r.p="",r(r.s=0)
    }([
      function(t,r,e){
        "use strict";
        function a(t,r,e,a,n){
          for(var o=0,u=r[0],f=1,h=r.length;f<h;++f){
            var l=r[f];
            o+=Math.sqrt(Math.pow(l[0]-u[0],2)+Math.pow(l[1]-u[1],2)),u=l
          }
          var p=e(t),c="left"==n?0:"right"==n?1:.5,i=(o-p)*c,s=0,M=r.length,v=r[s][0]>r[M-1][0],d=t.length,w=r[s][0],x=r[s][1];
          s+=1;
          for(var g,P=r[s][0],b=r[s][1],y=0,O=Math.sqrt(Math.pow(P-w,2)+Math.pow(b-x,2)),f=0;f<d;++f){
            g=v?d-f-1:f;
            for(var _=t[g],j=e(_),q=i+j/2;s<M-1&&y+O<q;)
              w=P,x=b,s+=1,P=r[s][0],b=r[s][1],y+=O,O=Math.sqrt(Math.pow(P-w,2)+Math.pow(b-x,2));
            var m=q-y,I=Math.atan2(b-x,P-w);
            v&&(I+=I>0?-Math.PI:Math.PI);
            var k=m/O;a(_,w+k*(P-w),x+k*(b-x),I),i+=j
          }
        }
        Object.defineProperty(r,"__esModule",{value:!0}),r.default=a,t.exports=r.default
      }
    ]);*/

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
      options.edge_path_segment_length = options.edge_high_quality?.2:2 // in mm
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
            // Custom: edge colored as target
            var color = d3.color(ns.getNodeColor(options, g.getNodeAttributes(g.target(eid))))
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

      ns.getNodesBySize().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        var color = ns.getNodeColor(options, n)
        var radius = Math.max(options.node_size * n.size, stroke_width)

        // Custom: we add an offset to the node radius
        radius += ns.mm_to_px(0.033 /* in mm */)

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

      // Resize
      g.nodes().forEach(function(nid){
        var n = g.getNodeAttributes(nid)
        n.x = m.l + (dim.w-m.r-m.l) / 2 + (n.x - xcenter) * ratio
        n.y = m.t + (dim.h-m.t-m.b) / 2 + (n.y - ycenter) * ratio
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
  await renderer.renderAndSave(g, settings, thisFolder+'/Carto Twitter') // Custom
  // renderer.renderAndSaveAllTiles(g, settings)
}
