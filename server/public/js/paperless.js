window.onload = function (e) {
    var list = document.getElementsByClassName('paperless-attachment-file');

    for (var i = 0; i < list.length; i++) {
        var src = list[i].getAttribute('data-ext');
        list[i].style.backgroundImage = "url('images/" + src.replace(/^.*\./, '') + "-icon-48x48.png')";
        list[i].ondblclick = function (e) {
            window.external.openAttachment(e.currentTarget.getAttribute('data-src'));
        };
    }
    list = document.getElementsByTagName('embed');
    for (var i = 0; i < list.length; i++) {
        list[i].ondblclick = function (e) { window.external.openAttachment(e.currentTarget.getAttribute('src')); };
    }
    list = document.getElementsByTagName('img');
    for (var i = 0; i < list.length; i++) {
        list[i].ondblclick = function (e) { window.external.openAttachment(e.currentTarget.getAttribute('src')); };
    }
}
