
/**
 * 問題を解く
 */
function solve2(board) {
    // 候補キャッシュ（必要になったら埋める）
    const candidates = Array.from({ length: 9 }, () => Array(9).fill(undefined));
    // 影響が出たマスを再計算するためのセット
    const dirty = new Set(); // keyは "i,j"

    const blanks = findBlanks(board);
    const history = [];
    let i, j;

    // util: セルキー
    const key = (i, j) => `${i},${j}`;

    // util: (i,j) を基点に、同じ行・列・ボックスの未確定マスを dirty にする
    function markAffected(i, j) {
        // 行
        for (let c = 0; c < 9; c++) if (board[i][c] === 0) dirty.add(key(i, c));
        // 列
        for (let r = 0; r < 9; r++) if (board[r][j] === 0) dirty.add(key(r, j));
        // ボックス
        const br = Math.floor(i / 3) * 3, bc = Math.floor(j / 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) {
                if (board[r][c] === 0) dirty.add(key(r, c));
            }
        }
        // 自分自身も再計算対象に
        if (board[i][j] === 0) dirty.add(key(i, j));
    }

    // 最初は何もキャッシュされていないので、全空きマスを dirty に
    for (const [bi, bj] of blanks) if (board[bi][bj] === 0) dirty.add(key(bi, bj));

    while (true) {
        let minCand = Number.POSITIVE_INFINITY;
        let minBlankIndex = -1;

        // 候補最少の空きマスを探す
        for (let k = 0; k < blanks.length; k++) {
            [i, j] = blanks[k];
            if (board[i][j] !== 0) continue;

            // dirty か、まだ計算していなければ再計算
            if (dirty.has(key(i, j)) || candidates[i][j] === undefined) {
                candidates[i][j] = findCandidates(board, i, j);
                dirty.delete(key(i, j));
            }

            const len = candidates[i][j].length;
            if (len < minCand) {
                minCand = len;
                if (minCand === 0) break; // 破綻
                minBlankIndex = k;
            }
        }

        if (minCand === 0) {
            // 直前のセルに戻る（現在の i,j は候補0セル）
            board[i][j] = 0;                 // 念のため取り消し（既に0なら無害）
            const last = history.pop();
            if (!last) throw new Error('解なし');
            [i, j] = last;

            // 直前セルの候補が尽きていればさらに戻る
            while (!candidates[i][j].length) {
                board[i][j] = 0;
                // 取り消した影響を周辺に反映
                markAffected(i, j);
                const prev = history.pop();
                if (!prev) throw new Error('解なし');
                [i, j] = prev;
            }
        } else {
            // 未確定が残っていなければ完成
            if (minBlankIndex < 0) break;
            [i, j] = blanks[minBlankIndex];
        }

        // 候補から1つ選んで配置
        const val = pickAndRemove(candidates[i][j]);
        board[i][j] = val;

        // 置いた場所の影響を周辺に反映（行・列・ボックスをdirtyに）
        markAffected(i, j);

        history.push([i, j]);

        if (history.length === blanks.length) break;
    }

    return board;
}
/**
 * 問題を解く
 */
function solve(board) {
    const candidates = [[], [], [], [], [], [], [], [], []];
    let n = 0;

    // 空きマスの座標を抽出
    const blanks = findBlanks(board);

    while (n < blanks.length) {
        const [i, j] = blanks[n];
        board[i][j] = 0;

        // 初めて来た場合は候補を探す
        if (candidates[i][j] == undefined) {
            candidates[i][j] = findCandidates(board, i, j);
        }
        // 候補がない場合はバックトラックする
        if (isEmpty(candidates[i][j])) {
            candidates[i][j] = undefined;
            n--;
            //console.log(`n:${n}`);
            //console.log(`n:${n} i:${i} j:${j}: back`);
            continue;
        }

        // 候補がある場合は仮ぎめして次へ
        const c = pickAndRemove(candidates[i][j]);
        board[i][j] = c;
        n++;
    }
    return board;
}

/**
 * 問題を生成する
 */
function generateProblem(deleteCount) {
    const answer = generateCompleteBoard();
    const board = deepCopy(answer);

    let deletedCount = 0;
    while (deletedCount < deleteCount) {
        const i = random(9);
        const j = random(9);

        if (board[i][j] !== 0) {
            board[i][j] = 0;
            deletedCount++;
        }
    }

    return [answer, board];
}

/**
 * 完成盤面を生成する
 */
function generateCompleteBoard() {
    const board = [[], [], [], [], [], [], [], [], []];
    const candidates = [[], [], [], [], [], [], [], [], []];
    let i = 0;
    let j = 0;

    while (true) {
        //console.log(candidates[i][j]);
        //console.log(`i:${i},j:${j},board:${board}`);
        if (candidates[i][j] == undefined) {
            // candidate[i][j] = board[i,j]の候補を列挙する
            candidates[i][j] = findCandidates(board, i, j);
        }
        if (isEmpty(candidates[i][j])) {
            candidates[i][j] = undefined;
            [i, j] = prev(i, j);
            board[i][j] = undefined;
            //console.log(`i:${i}, j:${j}: back`);
            continue;
        }

        // 候補からランダムに一つ選択。選択したものは配列から削除。
        const c = pickAndRemove(candidates[i][j]);
        board[i][j] = c;
        [i, j] = next(i, j);
        if (i == undefined) {
            break;
        }
    }

    return board;
}

function findCandidates(board, i, j) {
    //console.log(`i:${i},j:${j},board:${board}`);
    const base = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    // find in row
    const row = new Set(board[i]);
    const candRow = difference(base, row);

    // find in col
    const col = new Set(board.map(row => row[j]));
    const candCol = difference(base, col);

    // find in block
    const offsetX = Math.floor(i / 3) * 3;
    const offsetY = Math.floor(j / 3) * 3;

    const block = [];
    for (var x = 0; x < 3; x++) {
        for (var y = 0; y < 3; y++) {
            // TODO: 境界値チェックを入れる
            block.push(board[offsetX + x][offsetY + y]);
        }
    }
    const blockSet = new Set(block);
    const candBlock = difference(base, blockSet);

    cand = intersection(candRow, candCol, candBlock);

    return cand;
}

function next(i, j) {
    if (i == 8 && j == 8) {
        return [undefined, undefined];
    } else if (j == 8) {
        return [i + 1, 0];
    } else {
        return [i, j + 1];
    }
}

function prev(i, j) {
    if (i == 0 && j == 0) {
        return [undefined, undefined];
    } else if (j == 0) {
        return [i - 1, 8];
    } else {
        return [i, j - 1];
    }
}

function pickAndRemove(arr) {
    if (arr.length === 0) return undefined; // 空配列なら何も返さない

    const idx = 0;//Math.floor(Math.random() * arr.length);
    const [picked] = arr.splice(idx, 1); // spliceで削除＋取り出し
    return picked;
}

function findBlanks(board) {
    const blanks = [];
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (board[i][j] === 0) {
                blanks.push([i, j]);
            }
        }
    }
    return blanks;
}

function check(answer, board) {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (answer[i][j] !== board[i][j]) {
                return false;
            }
        }
    }
    return true;
}

function toString(board) {
    return board.map(row => row.join("")).join("\n");
}

function intersection(...arrays) {
    return arrays.reduce((acc, curr) => {
        const setCurr = new Set(curr);
        return acc.filter(x => setCurr.has(x));
    });
}

function difference(a, b) {
    return a.filter(x => !b.has(x));
}

function isEmpty(arr) {
    const result = Array.isArray(arr) && arr.length === 0;
    // console.log(`isEmpty:${result}`);
    return result;
}

function random(n) {
    return Math.floor(Math.random() * n);
}

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}


// パフォーマンス計測用

function createBenchmarkFn(deleteCount) {
    return function () {
        const [expectedSolution, problem] = generateProblem(deleteCount);
        const p = JSON.parse(JSON.stringify(problem));
        //console.log('start:', JSON.stringify(expectedSolution), p);
        const actualSolution = solve2(problem);
        if (!isValidSudoku(actualSolution)) {
            console.log('fail:', expectedSolution, p, actualSolution);
        }
        //const result = check(expectedSolution, actualSolution);
        //if (result === false) {
        //console.log('fail:', expectedSolution, p, actualSolution);
        //}
    }
}

function measureAndReport(fn, iterations = 100) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fn();
        const end = performance.now();
        const elapsed = end - start;
        times.push(elapsed);
        console.log(`${i + 1}回目: ${elapsed.toFixed(2)}ms`);
    }

    times.sort((a, b) => a - b);
    const total = times.reduce((sum, t) => sum + t, 0);
    const avg = total / iterations;
    const min = times[0];
    const max = times[times.length - 1];
    const median = times[Math.floor(times.length / 2)];
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / iterations;
    const stddev = Math.sqrt(variance);

    console.log(
        `回数=${iterations} 平均=${avg.toFixed(2)}ms 中央=${median.toFixed(2)}ms 最小=${min.toFixed(2)}ms 最大=${max.toFixed(2)}ms 分散=${stddev.toFixed(2)}ms`

        //`runs=${iterations} avg=${avg.toFixed(3)}ms median=${median.toFixed(3)}ms min=${min.toFixed(3)}ms max=${max.toFixed(3)}ms stddev=${stddev.toFixed(3)}ms`
    );
}

// --- 使い方例 ---
function testFn() {
    let sum = 0;
    for (let i = 0; i < 1e5; i++) sum += i;
    return sum;
}

// measureAndReport(testFn, 100);


/**
 * 数独の完成盤が妥当かを検査する（9x9 / 各行・各列・各3x3ボックスに 1〜9 が一度ずつ）
 * - 0 や範囲外の数値が含まれていれば false
 * - 重複があれば false
 * - 盤面サイズが 9x9 でなければ false
 */
function isValidSudoku(board) {
    // 形状チェック
    if (!Array.isArray(board) || board.length !== 9) return false;
    for (let r = 0; r < 9; r++) {
        if (!Array.isArray(board[r]) || board[r].length !== 9) return false;
    }

    const inRange = (v) => Number.isInteger(v) && v >= 1 && v <= 9;

    // 行チェック
    for (let r = 0; r < 9; r++) {
        const seen = new Set();
        for (let c = 0; c < 9; c++) {
            const v = board[r][c];
            if (!inRange(v) || seen.has(v)) return false;
            seen.add(v);
        }
    }

    // 列チェック
    for (let c = 0; c < 9; c++) {
        const seen = new Set();
        for (let r = 0; r < 9; r++) {
            const v = board[r][c];
            if (!inRange(v) || seen.has(v)) return false;
            seen.add(v);
        }
    }

    // 3x3 ボックスチェック
    for (let br = 0; br < 9; br += 3) {
        for (let bc = 0; bc < 9; bc += 3) {
            const seen = new Set();
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const v = board[br + r][bc + c];
                    if (!inRange(v) || seen.has(v)) return false;
                    seen.add(v);
                }
            }
        }
    }

    return true;
}


const p =
    [[0, 9, 0, 5, 0, 0, 0, 0, 1],
    [0, 0, 2, 0, 0, 0, 0, 0, 4],
    [0, 0, 7, 0, 1, 8, 9, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 8, 0],
    [0, 0, 0, 8, 4, 1, 3, 0, 0],
    [0, 4, 0, 0, 0, 7, 0, 0, 0],
    [0, 0, 0, 0, 8, 0, 0, 0, 0],
    [0, 0, 0, 0, 9, 0, 0, 0, 0],
    [0, 0, 9, 0, 0, 2, 0, 4, 0]];