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

async function initAudio() {
    if (!audioStarted) { 
        await Tone.start();
        audioStarted = true;
        Tone.Destination.volume.value = -20;
    }
}

// 更新プログラム
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const simplify = (n, d) => { const g = Math.abs(gcd(n, d)); return { n: n / g, d: d / g }; };
const multiply = (a, b) => simplify(a.n * b.n, a.d * b.d);
const power = (f, e) => {
    if (e === 0) return { n: 1, d: 1 };
    const r = { n: Math.pow(f.n, Math.abs(e)), d: Math.pow(f.d, Math.abs(e)) };
    return e > 0 ? simplify(r.n, r.d) : simplify(r.d, r.n);
};
const modepower = (dx,rx) => {
    let exp = {
        n: 0 * dx*rx.n + rx.d * 1,
        d: 1 * rx.d,
    }
    return exp;
}

function setDirection(x,y){
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
        
        const [x,y] = pos.split(',');
        const [dx,dy] = setDirection(x,y);
        

        let rat = { n: 1, d: 1 };
        let exp = { n: 0, d: 1 };

        if(xPower) exp = modepower(dx, rx);
        else rat = multiply(rat , power(rx, dx));
        if(yPower) exp = modepower(dy, ry);
        else rat = multiply(rat , power(ry, dy));
        
        const simpleExp = simplify(exp.n,exp.d);

        const freq = (base_f 
            *Math.pow(rx.n / rx.d, xPower ? 0 : dx)
            *Math.pow(2, xPower ? (dx*rx.n / rx.d) : 0)
            *Math.pow(ry.n / ry.d, yPower ? 0 : dy)
            *Math.pow(2, yPower ? (dy*ry.n / ry.d) : 0)
        );
        (cell as HTMLElement).dataset.freq = String(freq);

        if(xPower === yPower){
            if(xPower) tpow.textContent = `P(${dx},${dy})`;
            else tpow.textContent = '';
        }else tpow.textContent = `P(${xPower ? dx : dy})`;

        if(rat.n === 1 && rat.d === 1 && simpleExp.n && simpleExp.d){
            ratio_n.textContent = '';
            ratio_d.textContent = '';
        }else{
            ratio_n.textContent = `${rat.n}`;
            ratio_d.textContent = `${rat.d}`;
        }
    });
}

const setup = () => {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const [x, y] = (cell as HTMLElement).dataset.pos
                .split(',')
                .map(Number);

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
function play(x,y){
    if(!audioStarted) initAudio();
    const key = `${x},${y}`;
    if(synths.has(key)) return;
    const cell = document.querySelector(`[data-pos="${key}"]`);
    if(!cell) return;
    const freq = parseFloat((cell as HTMLElement).dataset.freq);

    const synth = new Tone.Synth({
        oscillator: {type: 'triangle'},
        envelope: {attack: 0.02, release: 0.5, sustain: 1 }
    }).toDestination();
    
    synth.triggerAttack(freq);
    synths.set(key,synth);
    activeNotes.add(key);
    document.querySelector(`[data-pos="${key}"]`)?.classList.add('active');
}

function stop(x,y){
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
        const freq = parseFloat((cell as HTMLElement).dataset.freq);
        synth.frequency.rampTo(freq, 0.05);
    })
}

// 操作関連
function transform(trans_func){
    if(!activeNotes.size) return;
    const currentNotesArr = Array.from(activeNotes).map(c => c.split(',').map(Number));
    const nextNotesArr = trans_func(currentNotesArr);
    const canMove = nextNotesArr.every(([nx,ny]) => 
        nx >= 0 && nx < size && ny >= 0 && ny < size
    );
    if(!canMove) return;

    currentNotesArr.forEach(([x,y]) => stop(x,y));
    const nextSet = new Set<string>();
    nextNotesArr.forEach(([nx,ny]) => {
        nextSet.add(`${nx},${ny}`);
        play(nx, ny);
    });
    activeNotes = nextSet;
}

function shift(dx, dy) {
    transform(notes => 
        notes.map(([x, y]) => [x + dx, y + dy])
    );
}

function rotate() {
    transform(notes => {
        const avgX = notes.reduce((sum, [x]) => sum + x, 0) / notes.length;
        const avgY = notes.reduce((sum, [, y]) => sum + y, 0) / notes.length;

        return notes.map(([x, y]) => [
            Math.round(avgX - (y - avgY)),
            Math.round(avgY + (x - avgX))
        ]);
    });
}

// Control
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
        update();
        refreshNotes();
    }
});

const le_toggle = document.getElementById('l/e-toggle');

document.getElementById('update-btn').onclick = update;
le_toggle.addEventListener('click', () =>{
    const isActive = le_toggle.classList.toggle('is-active');
    euler_mode = isActive;
})

setup();

/*
ドラッグ移動
modulo対応
*/
