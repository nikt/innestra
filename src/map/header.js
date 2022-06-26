export class Header {
    constructor() {
        this.overlay = document.createElement('div');
    };

    buildHeader() {
        this.overlay.classList.add('overlay');
        document.body.appendChild(this.overlay);
    }

    setInnerHTML(str) {
        this.overlay.innerHTML = str;
    }
};
