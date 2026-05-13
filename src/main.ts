import * as Tone from 'tone'
const size=11
const size_half = Math.floor(size/2)
let center = { x: size_half, y: size_half };
const base_f = 440 * Math.pow(2,3/12)/2
let Compass = 0;


let audioStarted = false;
let activeNotes = new Set<string>();
const synths = new Map();

let euler_mode = false;
let modulo_mode = false;

async function initAudio() {
    if (!audioStarted) { 
        await Tone.start();
        audioStarted = true;
        Tone.Destination.volume.value = -20;
    }
}

// 更新プログラム
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
const simplify = (n: number, d: number) => { const g = Math.abs(gcd(n, d)); return { n: n / g, d: d / g }; };
const multiply = (a: any, b: any) => simplify(a.n * b.n, a.d * b.d);
const power = (f: any, e: any) => {
    if (e === 0) return { n: 1, d: 1 };
    const r = { n: Math.pow(f.n, Math.abs(e)), d: Math.pow(f.d, Math.abs(e)) };
    return e > 0 ? simplify(r.n, r.d) : simplify(r.d, r.n);
};

function setDirection(x: number,y: number){
    let dx = Number(x)-center.x;
    let dy = center.y-Number(y);
    switch(Compass){
        case 0:/*[dx,dy] = [ dx, dy];*/break;
        case 1:  [dx,dy] = [-dy, dx];  break;
        case 2:  [dx,dy] = [-dx,-dy];  break;
        case 3:  [dx,dy] = [ dy,-dx];  break;
    }
    return [dx,dy];
}

const calc_freq = (rat:any,dx:number, dy:number, rx: any, ry: any, xPower: boolean,yPower: boolean) => {
    let freq = base_f * (rat.n / rat.d);
    
    if(xPower) freq *= Math.pow(2, dx * rx.n / rx.d);
    if(yPower) freq *= Math.pow(2, dy * ry.n / ry.d);

    if(modulo_mode) freq = modulo_freq(freq);

    return freq;
}

const modulo_normalize = (rat: any) => {
    if(!rat.n || !rat.d) return rat;
    while(rat.n / rat.d < 0.5) rat.n*=2;
    while(rat.n / rat.d > 2) rat.d*=2;
    return simplify(rat.n,rat.d);
}

const modulo_freq = (freq: number) =>{
  const under_f = base_f /2;
  const ratio = freq / under_f;
  const octaves = Math.log2(ratio);
  return under_f * Math.pow(2, ((octaves % 2) +2) %2);
}

const update = () =>{
    const cells = document.querySelectorAll('.cell');
    const rx = { 
        n: parseInt((document.getElementById('x-num') as HTMLInputElement).value), 
        d: parseInt((document.getElementById('x-den') as HTMLInputElement).value)
    };
    const ry = { 
        n: parseInt((document.getElementById('y-num') as HTMLInputElement).value),
        d: parseInt((document.getElementById('y-den') as HTMLInputElement).value)
    };
    const xPower = (document.getElementById('x-chk') as HTMLInputElement).checked;
    const yPower = (document.getElementById('y-chk') as HTMLInputElement).checked;

    cells.forEach(cell => {
        const pos = cell.getAttribute('data-pos');
        const tpow = cell.querySelector('.tpow');
        const ratio_n = cell.querySelector('.ratio_n');
        const ratio_d = cell.querySelector('.ratio_d');
        
        const [x,y] = pos!.split(',');
        const [dx,dy] = setDirection(Number(x),Number(y));
        
        let rat = { n: 1, d: 1 };

        if(!xPower) rat = multiply(rat , power(rx, dx));
        if(!yPower) rat = multiply(rat , power(ry, dy));
        if(modulo_mode) rat = modulo_normalize(rat);
        
        const freq = calc_freq(rat, dx,dy,rx,ry,xPower,yPower);
        

        if(xPower === yPower){
            if(xPower) tpow!.textContent = `P(${dx},${dy})`;
            else tpow!.textContent = '';
        }else tpow!.textContent = `P(${xPower ? dx : dy})`;
        (cell as HTMLElement).dataset.freq = String(freq);

        if(rat.n === 1 && rat.d === 1){
            ratio_n!.textContent = '';
            ratio_d!.textContent = '';
        }else{
            ratio_n!.textContent = `${rat.n}`;
            ratio_d!.textContent = `${rat.d}`;
        }
    });
}

const setup = () => {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const [x, y] = ((cell as HTMLElement).dataset.pos || "").split(',').map(Number);

            if (!cell.classList.contains('active')) {
                play(x, y);
            } else {
                stop(x, y);
            }
        });
    });
    update();
};

// 音
function play(x:number,y:number){
    if(!audioStarted) initAudio();
    const key = `${x},${y}`;
    if(synths.has(key)) return;
    const cell = document.querySelector(`[data-pos="${key}"]`);
    if(!cell) return;
    const freq = parseFloat((cell as HTMLElement)!.dataset.freq || "0");

    const synth = new Tone.Synth({
        oscillator: {type: 'triangle'},
        envelope: {attack: 0.02, release: 0.5, sustain: 1 }
    }).toDestination();
    
    synth.triggerAttack(freq);
    synths.set(key,synth);
    activeNotes.add(key);
    document.querySelector(`[data-pos="${key}"]`)?.classList.add('active');
}

function stop(x:number,y:number){
    const key = `${x},${y}`;
    if(synths.has(key)){
        const s = synths.get(key);
        s.triggerRelease();
        setTimeout(() => s.dispose(), 500);
        synths.delete(key);
        activeNotes.delete(key);
        document.querySelector(`[data-pos="${key}"]`)?.classList.remove('active');
    }
}

function refreshNotes(){
    activeNotes.forEach(key => {
        const synth = synths.get(key);
        if(!synth) return;
        const cell = document.querySelector(`[data-pos="${key}"]`);
        if(!cell) return;
        const freq = parseFloat((cell as HTMLElement)!.dataset.freq || "0");
        synth.frequency.rampTo(freq, 0.05);
    })
}

// 操作関連
function transform(trans_func: (notes: number[][]) => number[][] ){
    if(!activeNotes.size) return;
    const currentNotesArr = Array.from(activeNotes).map(c => c.split(',').map(Number));
    const nextNotesArr = trans_func(currentNotesArr);
    const canMove = nextNotesArr.every(([nx,ny]: number[]) => 
        nx >= 0 && nx < size && ny >= 0 && ny < size
    );
    if(!canMove) return;

    currentNotesArr.forEach(([x,y]) => stop(x,y));
    const nextSet = new Set<string>();
    nextNotesArr.forEach(([nx,ny]: number[]) => {
        nextSet.add(`${nx},${ny}`);
        play(nx, ny);
    });
    activeNotes = nextSet;
}

function shift(dx:number, dy:number) {
    transform(notes => 
        notes.map(([x, y]: number[]) => [x + dx, y + dy])
    );
}

function rotate() {
    transform(notes => {
        const avgX = notes.reduce((sum:number, [x]:number[]) => sum + x, 0) / notes.length;
        const avgY = notes.reduce((sum:number, [, y]:number[]) => sum + y, 0) / notes.length;

        return notes.map(([x, y]) => [
            Math.round(avgX - (y - avgY)),
            Math.round(avgY + (x - avgX))
        ]);
    });
}

// Control
const refresh = () => {
  update();
  refreshNotes();
}

window.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow')) e.preventDefault();
    if(!euler_mode){
        switch(e.key) {
            case 'ArrowUp':    shift(0, -1); break;
            case 'ArrowDown':  shift(0, 1); break;
            case 'ArrowLeft':  shift(-1, 0); break;
            case 'ArrowRight': shift(1, 0); break;
            case 'r': rotate(); break;
        }
    }else{
        switch(e.key) {
            case 'ArrowUp':    center.y--; break;
            case 'ArrowDown':  center.y++; break;
            case 'ArrowLeft':  center.x--; break;
            case 'ArrowRight': center.x++; break;
            case 'r': Compass === 3 ? Compass = 0 : Compass++; break;
        }
        refresh();
    }
});

const le_toggle = document.getElementById('l/e-toggle');
le_toggle!.addEventListener('click', () =>{
    const isActive = le_toggle!.classList.toggle('is-active');
    euler_mode = isActive;
})

const modulo_toggle = document.getElementById('modulo-toggle');
modulo_toggle!.addEventListener('click', () =>{
    const isActive = modulo_toggle!.classList.toggle('is-active');
    modulo_mode = isActive;
    refresh();
})


document.getElementById('update-btn')!.onclick = refresh;
setup();