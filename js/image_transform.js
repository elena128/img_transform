/* image_transform.JS 
 * 选择图片并处理：缩放、拖拽、旋转，并截取指定区域，生成base64图片
 * 兼容pc和移动端
 * pc端双击旋转，滚动鼠标缩放
 * 移动端双指交叉移动旋转，双指同时向内或向外移动缩放
 * by elena 2016-7-10 */

$.fn.imageTransform = function (option) {
  var defaultOption = {
    width: 200,
    height: 200,
    file: "",
    view: "",
    ok: "",
    loadComplete: function () { },
    loadError: function () { },
    clipFinish: function () { }
  }

  $.extend(defaultOption, option);

  imageTransform(this, defaultOption);

  return this;
}

function imageTransform(con, ops) {
  var clip_width = ops.width;
  var clip_height = ops.height;
  var file = ops.file;
  var upload = ops.upload;
  var img = ops.view;
  var ok = ops.ok;
  var type;
  var el = document.querySelector(ops.view);
  var ticking = false;
  var transform;
  var initScale;
  var initAngle;
  var cur_x, cur_y, init_x, init_y, move_x, move_y;
  var mc = new Hammer.Manager(el);
  // 添加手势事件
  mc.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
  mc.add(new Hammer.Swipe()).recognizeWith(mc.get('pan'));
  mc.add(new Hammer.Rotate({ threshold: 0 })).recognizeWith(mc.get('pan'));
  mc.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith([mc.get('pan'), mc.get('rotate')]);

  mc.on("panstart", onPanstart);
  mc.on("panmove", onPanmove);
  mc.on("rotatestart rotatemove", onRotate);
  mc.on("pinchstart pinchmove", onPinch);
  // 生成截取区域并高亮，其他区域渐暗显示
  build_mask(con);
  // 判断是否移动设备
  ismobile();
  // 鼠标滚动事件
  $(img).mousewheel(function (event, delta) {
    transform.scale = transform.scale + delta * 0.05;
    if (transform.scale <= 0.1) {
      transform.scale = 0.1
    }
    event.preventDefault();
    requestElementUpdate();
  });
  // 选择图片后预览图片
  $(file).change(function () {
    var file = this.files[0];
    loadImage(file);
  });
  // 截取图片，经过数学计算得到高亮区域里的图片
  $(ok).click(function () {
    if (!transform) {
      alert("请选择您要分享图片~");
      return false;
    }
    var center_x = transform.translate.x;
    var center_y = transform.translate.y;
    var img_width = $(img).width() * transform.scale;
    var img_height = $(img).height() * transform.scale;
    var local_x = (con.width() - clip_width) / 2;
    var local_y = (con.height() - clip_height) / 2;
    var cvs = document.createElement('canvas');
    var ctx = cvs.getContext("2d");
    cvs.width = clip_width / transform.scale;
    cvs.height = clip_height / transform.scale;
    if (transform.angle) {
      ctx.translate(cvs.width / 2, cvs.height / 2);
      ctx.rotate(transform.angle * Math.PI / 180);
      if (transform.angle == 90) {
        local_x = local_x + clip_width;
        var px = (local_x - (center_x + img_height / 2)) / transform.scale;
        var py = ((center_y - img_width / 2) - local_y) / transform.scale;
        ctx.translate(py, px);
      } else if (transform.angle == 180) {
        local_x = local_x + clip_width;
        local_y = local_y + clip_height;
        var px = (local_x - (center_x + img_width / 2)) / transform.scale;
        var py = (local_y - (center_y + img_height / 2)) / transform.scale;
        ctx.translate(px, py);
      } else if (transform.angle == 270) {
        local_y = local_y + clip_height;
        var px = ((center_x - img_height / 2) - local_x) / transform.scale;
        var py = (local_y - (center_y + img_width / 2)) / transform.scale;
        ctx.translate(py, px);
      }
      ctx.drawImage($(img)[0], -cvs.width / 2, -cvs.height / 2);
    } else {
      var px = ((center_x - img_width / 2) - local_x) / transform.scale;
      var py = ((center_y - img_height / 2) - local_y) / transform.scale;
      ctx.translate(px, py);
      ctx.drawImage($(img)[0], 0, 0);
    }
    ctx.restore();
    var ImageData = cvs.toDataURL(type, 1);
    ops.clipFinish(ImageData);
  })
  // 判断设备类型函数
  function ismobile() {
    var is_mobile = !!navigator.userAgent.match(/mobile/i);
    if (is_mobile) {
      $(".pc_word").hide()
    } else {
      init_drag();
      $(img).on("dblclick", function () {
        onRotate_pc();
      });
    }
  }
  // pc端图片拖拽选择事件
  function init_drag() {
    var target = document.querySelector(upload);
    target.addEventListener("dragover", function (e) {
      e.preventDefault();
      $(this).addClass("active");
    }, true);
    target.addEventListener("drop", function (e) {
      e.preventDefault();
      $(this).removeClass("active");
      console.log(e.dataTransfer.files[0]);
      loadImage(e.dataTransfer.files[0]);
    }, true);
  }
  // 预览图片
  function loadImage(file) {
    type = file.type;
    var reader = new FileReader();
    reader.onload = function (e) {
      var imgobj = e.target.result;
      var $tempImg = $("<img>");
      $tempImg.load(function () {
        var w = this.naturalWidth;
        if (w > 480) {
          $(img).attr("src", compressImg(this))
        } else {
          $(img).attr("src", this.src)
        }
        ops.loadComplete();
        resetElement();
      });
      $tempImg.attr("src", imgobj);
    };
    reader.onerror = function (e) {
      ops.loadError("图片加载失败");
    };
    reader.readAsDataURL(file);
  }
  // 图片尺寸过大时，压缩图片
  function compressImg(sourceImgObj) {
    var drawWidth = sourceImgObj.naturalWidth,
      drawHeight = sourceImgObj.naturalHeight;
    var newWidth = 480;
    var newHeight = 480 * drawHeight / drawWidth;
    var cvs = document.createElement('canvas');
    var ctx = cvs.getContext("2d");
    cvs.width = newWidth;
    cvs.height = newHeight;

    ctx.drawImage(sourceImgObj, 0, 0, newWidth, newHeight);
    var newImageData = cvs.toDataURL(type, 0.5);
    return newImageData;
  }
  // 初始化图片位置
  function resetElement() {
    init_x = $(con).width() / 2;
    init_y = $(con).height() / 2;
    transform = {
      translate: { x: init_x, y: init_y },
      scale: 1,
      angle: 0
    };
    requestElementUpdate();
  }
  // 进行变换
  function requestElementUpdate() {
    if (!ticking) {
      reqAnimationFrame(updateElementTransform);
      ticking = true;
    }
  }
  // 动画函数（保证图片变换时流畅性）
  var reqAnimationFrame = (function () {
    return window[Hammer.prefixed(window, 'requestAnimationFrame')]
  })();
  // 变换函数
  function updateElementTransform() {
    var value = [
      'translate3d(' + (transform.translate.x - $(img).width() / 2) + 'px, ' + (transform.translate.y - $(img).height() / 2) + 'px, 0)',
      'scale(' + transform.scale + ')',
      'rotate(' + transform.angle + 'deg)'
    ];
    value = value.join(" ");
    el.style.webkitTransform = value;
    el.style.mozTransform = value;
    el.style.transform = value;
    ticking = false;
  }
  // 单指移动
  function onPinch(ev) {
    if (ev.type == 'pinchstart') {
      initScale = transform.scale || 1;
    }
    transform.scale = initScale * ev.scale;
    if (transform.scale <= 0.1) {
      transform.scale = 0.1
    }
    requestElementUpdate();
  }
  // 旋转
  function onRotate(ev) {
    if (ev.type == 'rotatestart') {
      initAngle = transform.angle || 0;
    }
    if (Math.abs(ev.rotation) > 20) {
      var rotateDirection = ev.rotation > 0 ? 1 : ev.rotation < 0 ? -1 : 0;
      if (initAngle > 180) {
        initAngle -= 360;
      } else if (initAngle < -180) {
        initAngle += 360;
      }
      if (rotateDirection == 1) {
        ev.rotation = 90;
      } else if (rotateDirection == -1) {
        ev.rotation = -90;
      }
      transform.angle = initAngle + ev.rotation;
      requestElementUpdate();
    }
  }
  // pc端旋转
  function onRotate_pc() {
    initAngle = transform.angle || 0;
    if (initAngle > 180) {
      initAngle -= 360;
    } else if (initAngle < -180) {
      initAngle += 360;
    }
    transform.angle = initAngle + 90;
    requestElementUpdate();
  }
  // 开始单指移动
  function onPanstart(ev) {
    move_x = transform.translate.x - init_x;
    move_y = transform.translate.y - init_y;
  }
  // 单指移动中
  function onPanmove(ev) {
    var movex = move_x + ev.deltaX;
    var movey = move_x + ev.deltaY;
    if (Math.abs(movex) > 200 || Math.abs(movey) > 200) {
      return false;
    } else {
      transform.translate = {
        x: movex + init_x,
        y: movey + init_y
      };
      requestElementUpdate();
    }
  }
  // 初始化预览截取高亮区和渐暗区
  function build_mask(ele) {
    var $mask = $("<div class='photo-clip-mask'>").css({
      "position": "absolute",
      "top": "0",
      "left": "0",
      "bottom": "0",
      "right": "0",
      "pointer-events": "none"
    }).appendTo($(ele));
    var $mask_left = $("<div class='photo-clip-mask-left'>").css({
      "position": "absolute",
      "left": 0,
      "right": "50%",
      "top": "50%",
      "bottom": "50%",
      "width": "auto",
      "height": clip_height,
      "margin-right": clip_width / 2,
      "margin-top": -clip_height / 2,
      "margin-bottom": -clip_height / 2,
      "background-color": "rgba(0,0,0,.5)"
    }).appendTo($mask);
    var $mask_right = $("<div class='photo-clip-mask-right'>").css({
      "position": "absolute",
      "left": "50%",
      "right": 0,
      "top": "50%",
      "bottom": "50%",
      "margin-left": clip_width / 2,
      "margin-top": -clip_height / 2,
      "margin-bottom": -clip_height / 2,
      "background-color": "rgba(0,0,0,.5)"
    }).appendTo($mask);
    var $mask_top = $("<div class='photo-clip-mask-top'>").css({
      "position": "absolute",
      "left": 0,
      "right": 0,
      "top": 0,
      "bottom": "50%",
      "margin-bottom": clip_height / 2,
      "background-color": "rgba(0,0,0,.5)"
    }).appendTo($mask);
    var $mask_bottom = $("<div class='photo-clip-mask-bottom'>").css({
      "position": "absolute",
      "left": 0,
      "right": 0,
      "top": "50%",
      "bottom": 0,
      "margin-top": clip_height / 2,
      "background-color": "rgba(0,0,0,.5)"
    }).appendTo($mask);
    // 创建截取区域
    var $clip_area = $("<div class='photo-clip-area'>").css({
      "position": "absolute",
      "left": "50%",
      "top": "50%",
      "width": clip_width,
      "height": clip_height,
      "margin-left": -clip_width / 2 - 1,
      "margin-top": -clip_height / 2 - 1
    }).appendTo($mask);
    return this;
  }
}
