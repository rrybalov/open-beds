// Test-only stand-in for Leaflet (the CDN isn't reachable from the test container).
(function(){
  function Map(id){ this.el=document.getElementById(id); this.el.style.position="relative"; this.z=7; this.handlers={}; var me=this;
    this.scrollWheelZoom={enable:function(){},disable:function(){}}; this.c=[0,0]; window.__map=this; }
  Map.prototype.setView=function(c,z){this.c=c;this.z=z||this.z;return this;};
  Map.prototype.fitBounds=function(b){this.fit=b;return this;};
  Map.prototype.invalidateSize=function(){return this;};
  Map.prototype.on=function(){return this;};
  Map.prototype.panTo=function(c){this.pan=c;return this;};
  Map.prototype.getZoom=function(){return this.z;};
  function Layer(){this.items=[];}
  Layer.prototype.addTo=function(m){this.m=m;return this;};
  Layer.prototype.clearLayers=function(){this.items.forEach(function(i){i.remove();});this.items=[];};
  function Marker(ll,o){this.ll=ll;this.o=o;this.h={};}
  Marker.prototype.on=function(e,f){this.h[e]=f;return this;};
  Marker.prototype.bindPopup=function(h){this.h=h;return this;};
  Marker.prototype.addTo=function(t){var host=t.el?t:t.m; this.host=host; var d=document.createElement("div"); d.className="stub-marker"; d.title=this.o.title; d.innerHTML=this.o.icon.html; var me=this; d.addEventListener("click",function(){ if(me.h.click) me.h.click(); }); d.dataset.title=this.o.title; host.el.appendChild(d); this.d=d; if(t.items)t.items.push(this); return this;};
  Marker.prototype.remove=function(){ if(this.d)this.d.remove(); if(this.p)this.p.remove(); };
  Marker.prototype.getLatLng=function(){return {lat:this.ll[0],lng:this.ll[1]};};
  Marker.prototype.openPopup=function(){ document.querySelectorAll(".stub-popup").forEach(function(x){x.remove();}); var p=document.createElement("div"); p.className="stub-popup"; p.innerHTML=this.h; this.host.el.appendChild(p); this.p=p; return this;};
  Marker.prototype.isPopupOpen=function(){return !!(this.p&&this.p.isConnected);};
  window.L={ map:function(id,o){return new Map(id);}, tileLayer:function(){return {addTo:function(){return this;}};},
    layerGroup:function(){return new Layer();}, marker:function(ll,o){return new Marker(ll,o);}, divIcon:function(o){return o;},
    latLngBounds:function(p){return p;} };
})();
