window.onload = function () {
  var list = document.getElementsByClassName("paperless-attachment-file");

  for (var i = 0; i < list.length; i++) {
    var src = list[i].getAttribute("data-ext");
    list[i].style.backgroundImage =
      "url('images/" + src.replace(/^.*\./, "") + "-icon-48x48.png')";
    list[i].ondblclick = function (e) {
      window.external.openAttachment(e.currentTarget.getAttribute("data-src"));
    };
  }
  list = document.getElementsByTagName("embed");
  for (var j = 0; j < list.length; j++) {
    list[j].ondblclick = function (e) {
      window.external.openAttachment(e.currentTarget.getAttribute("src"));
    };
  }
  list = document.getElementsByTagName("img");
  for (var k = 0; k < list.length; k++) {
    list[k].ondblclick = function (e) {
      window.external.openAttachment(e.currentTarget.getAttribute("src"));
    };
  }
};
