/*!
 *                                                                                                                         (℠)
 *  # RangefinderFocuser: Utility for Search and Selection
 *
 *  * © Satoru Matsushima - https://github.com/satorumurmur/RangefinderFocuser
 *  * Open source under the MIT license. - https://github.com/satorumurmur/RangefinderFocuser/blob/main/LICENSE
 *
 */

export class RangefinderFocuser {
    static PreRE = /^[\w\d]([\w\d-:]*[\w\d])?$/;
    static RFs = new Map();
    static Overridables = {
        searchContent: 'function',
        getNearestSearchResultIndex: 'function',
        isInCurrentView: 'function',
        moveTo: 'function',
        getSelection: 'function',
        EventManager: 'object'
    };
    constructor(Pre = 'range-finder', Overrides = {}) {
        const _ = RangefinderFocuser;
        if(!_.PreRE.test(Pre)) throw new Error('RangefinderFocuser: Requires Well-formed Prefix: /^[\w\d]([\w\d-:]*[\w\d])?$/.test(Prefix) === true');
        if(!_.RFs.has(Pre)) _.RFs.set(Pre, this); else return console.log('RangefinderFocuser: Returns Same-Prefixed Existing Instance.') || _.RFs.get(Pre);
        this.Prefix = Pre;
        Object.entries(Overrides).forEach(([N, V]) => V && typeof V === _.Overridables[N] && (this[N] = V));
        if(!this.searchContent)               this.searchContent               = this.searchDocument;
        if(!this.isInCurrentView)             this.isInCurrentView             = this.isInCurrentScrolledView;
        if(!this.moveTo)                      this.moveTo                      = this.scrollTo;
        if(!this.getNearestSearchResultIndex) this.getNearestSearchResultIndex = this.getNearestSearchResultIndexInDocument;
        if(!this.getSelection)                this.getSelection                = this.getSelectionOnDocument;
        if(!this.EventManager)                this.EventManager = {
            NameRE: new RegExp('^' + Pre + ':[\\w\\d]([\\w\\d\\-:]*[\\w\\d])?$'),
            N_f_aEL: new Map(),
            N_f_bEL: new Map(),
            add: function(Name, fun, Opt) {
                if(!this.NameRE.test(Name) || typeof fun !== 'function') return;
                const f_aEL = this.N_f_aEL.get(Name) || this.N_f_aEL.set(Name, new Map()).get(Name);
                if(!f_aEL.has(fun)) document.addEventListener(Name, f_aEL.set(fun, ({ detail }) => { if(Opt?.once) f_aEL.delete(fun); return fun.call(document, detail); }).get(fun), Opt);
            },
            remove: function(Name, fun, Opt) {
                if(!this.NameRE.test(Name) || typeof fun !== 'function') return;
                const f_aEL = this.N_f_aEL.get(Name);
                const aEL = f_aEL?.get(fun);
                if(aEL) f_aEL.delete(fun), document.removeEventListener(Name, aEL, Opt);
            },
            bind: function(Name, fun, Opt) {
                if(!this.NameRE.test(Name) || typeof fun !== 'function') return;
                const f_bEL = this.N_f_bEL.get(Name) || this.N_f_bEL.set(Name, new Map()).get(Name);
                if(!f_bEL.has(fun)) f_bEL.set(fun, (detail) => { if(Opt?.once) f_bEL.delete(fun); return fun.call(document, detail); });
            },
            unbind: function(Name, fun) {
                if(!this.NameRE.test(Name) || typeof fun !== 'function') return;
                const f_bEL = this.N_f_bEL.get(Name);
                if(f_bEL?.has(fun)) f_bEL.delete(fun);
            },
            dispatch: function(Name, detail) {
                if(!this.NameRE.test(Name)) return Promise.reject({ Name, detail });
                const f_bEL = this.N_f_bEL.get(Name);
                const Promised = f_bEL?.size ? Promise.allSettled([...f_bEL.values()].map(bEL => bEL(detail))) : Promise.resolve();
                document.dispatchEvent(new CustomEvent(Name, { detail }));
                return Promised;
            }
        };
        this.CurrentSearch = new RangefinderFocuser.Search();
    };
    static opt = (Opt) => {
        const { Flexible, Strict, ConvertBreaksTo } = Opt;
        if(!Opt || Flexible) return {};
        const Options = {
            CaseSensitive: true,
            WidthSensitive: true,
            ConvertBreaksTo: ' '
        };
        if(!Strict) for(const Key in Options) if(!Opt[Key]) delete Options[Key];
        if(typeof ConvertBreaksTo === 'string' && ConvertBreaksTo.length === 1) Options.ConvertBreaksTo = ConvertBreaksTo;
        return Options;
    };
    static flatten = (Str, { ConvertBreaksTo, WidthSensitive, CaseSensitive } = {}) => {
        Str = String(Str);
        Str = (typeof ConvertBreaksTo !== 'string' || ConvertBreaksTo.length !== 1 || ConvertBreaksTo === ' ') ?
            Str.replace(/\r/g, ' ').replace(/[\n\t]/g, ' ') :
            Str.replace(/\r/g, ' ').replace(/[\n]/g, ConvertBreaksTo).replace(/[\t]/g, ' ');
        if(!WidthSensitive) Str = Str.replace(/[！＂＃＄％＆＇（）＊＋，－．／０-９：；＜＝＞？＠Ａ-Ｚ［＼］＾＿｀ａ-ｚ｛｜｝～]/g, (Cha) => String.fromCharCode(Cha.charCodeAt(0) - 0xFEE0)).replace(/・/g, '.');
        if(! CaseSensitive) Str = Str.toLowerCase();
        return Str;
    };
    // range = (...Args) => { // [Range,] { Start: { In, On }, End: { In, On } } [, ...Opts]
    //     const Ran = Args[0]?.cloneRange ? Args.shift() : new Range();
    //     const { startContainer: _SCon, startOffset: _SOff, endContainer: _ECon, endOffset: _EOff } = Ran;
    //     const [{ Start,                              End,                              ...Opt }         ] = Args;
    //       let [{ Start: { In: SCon, At: SOff } = {}, End: { In: ECon, At: EOff } = {}         }, ...Opts] = Args;
    //     if(SCon === undefined) SCon = _SCon;  if(SOff === undefined) SOff = _SOff; else if(Number.isInteger(SOff) && SOff < 0) SOff = (SCon?.childNodes?.length || SCon?.textContent?.length || 0) + SOff;  if(SCon !== _SCon || SOff !== _SOff) Ran.setStart(SCon, SOff);
    //     if(ECon === undefined) ECon = _ECon;  if(EOff === undefined) EOff = _EOff; else if(Number.isInteger(EOff) && EOff < 0) EOff = (ECon?.childNodes?.length || ECon?.textContent?.length || 0) + EOff;  if(ECon !== _ECon || EOff !== _EOff)   Ran.setEnd(ECon, EOff);
    //     return Object.assign(Ran, Opt, ...Opts);
    // };
    // range = (...Args) => { // [Range,] { Start: { Container|startContainer, Offset|startOffset }, End: { Container|endContainer, Offset|endOffset } } [, ...Opts]
    //     const Ran = Args[0]?.cloneRange ? Args.shift() : new Range();
    //     let [ { Start: { startContainer, startOffset, Container: SCon = startContainer, Offset: SOff = startOffset } = {},
    //               End: {   endContainer,   endOffset, Container: ECon =   endContainer, Offset: EOff =   endOffset } = {}, ...Opt } = {}, ...Opts] = Args;
    //          if(SOff !== undefined) Ran.setStart(SCon = SCon || Ran.startContainer, SOff >= 0 ? SOff : (SCon.childNodes?.length || SCon.textContent?.length || 0) + SOff);
    //     else if(SCon !== undefined) Ran.setStart(SCon, Ran.startOffset);
    //          if(EOff !== undefined)   Ran.setEnd(ECon = ECon ||   Ran.endContainer, EOff >= 0 ? EOff : (ECon.childNodes?.length || ECon.textContent?.length || 0) + EOff);
    //     else if(ECon !== undefined)   Ran.setEnd(ECon,   Ran.endOffset);
    //     console.log(Opt);
    //     return Object.assign(Ran, Opt, ...Opts);
    // };
    getRangeOf = (Nd) => { const Ran = new Range(); Ran.selectNode(Nd);         return Ran; };
    getRangeIn = (Nd) => { const Ran = new Range(); Ran.selectNodeContents(Nd); return Ran; };
    findRange = (StrAsIs, CCon = document.body, Opt, /**/ Str, CTxt, CSteps = []) => {
        const { flatten } = RangefinderFocuser;
        if(!Str ) Str  = flatten(StrAsIs,          Opt);
        if(!CTxt) CTxt = flatten(CCon.textContent, Opt);
        if(!Str || !CTxt || CTxt.indexOf(Str) < 0) return null;
        while(CCon.childNodes.length === 1) CSteps.push(0), CCon = CCon.firstChild;
        switch(CCon.nodeType) {
            case 1: { // ElementNode (Start and End are in different text nodes.)
                /* .>|-----+++++++++++-----|-- */ const CCTxts = [], CCs = CCon.childNodes;  for(let CC, CCTxt, Found, i = 0; CC = CCs[i]; i++) if(Found = this.findRange('', CC, Opt, /**/ Str, CCTxt = flatten(CC.textContent, Opt), CSteps.concat(i))) return Found; else CCTxts.push(CCTxt);
                /* ...>[---+++]+++++++-----|.. */ let SCon;  const SSteps = [];  {  let i =              0;  while(CCTxts.slice(1    ).join('').indexOf(Str) >= 0) CCTxts.shift(), i++;  SCon = CCs[i];  SSteps.push(i);  }
                /* ....[---+++]+++[+++---]<... */ let ECon;  const ESteps = [];  {  let i = CCs.length - 1;  while(CCTxts.slice(0, -1).join('').indexOf(Str) >= 0) CCTxts.pop(),   i--;  ECon = CCs[i];  ESteps.push(i);  }
                /* ....[---###]<++[+++---].... */ let SStr = Str;  {  const ConTxt = flatten(SCon.textContent, Opt);  while(ConTxt.slice(   SStr.length * -1) !== SStr) SStr = SStr.slice(0, -1);  }  Str = Str.slice(SStr.length);
                /* ....[---###]..>[###---].... */ let EStr = Str;  {  const ConTxt = flatten(ECon.textContent, Opt);  while(ConTxt.slice(0, EStr.length     ) !== EStr) EStr = EStr.slice(1    );  }
                /* ......[-#]<....[###---].... */ while(SCon.nodeType === 1) {  const Cs = SCon.childNodes; let CTxtL, i = Cs.length - 1;  while((CTxtL = Cs[i].textContent?.length || 0) < SStr.length) CTxtL && (SStr = SStr.slice(0, CTxtL * -1)), i--;  SCon = Cs[i];  SSteps.push(i);  }
                /* ......[-#]......>[#-]...... */ while(ECon.nodeType === 1) {  const Cs = ECon.childNodes; let CTxtL, i =             0;  while((CTxtL = Cs[i].textContent?.length || 0) < EStr.length) CTxtL && (EStr = EStr.slice(CTxtL        )), i++;  ECon = Cs[i];  ESteps.push(i);  }
                const Ran = new Range();
                Ran.setStart(SCon, SCon.textContent.length - SStr.length);
                  Ran.setEnd(ECon,                           EStr.length);
                return Object.assign(Ran, {
                    StartContainerNodeSteps: CSteps.concat(SSteps),
                      EndContainerNodeSteps: CSteps.concat(ESteps)
                });
            }
            case 3: { // TextNode
                const Ran = new Range(), StartOffset = CTxt.indexOf(Str);
                Ran.setStart(CCon, StartOffset);
                  Ran.setEnd(CCon, StartOffset + Str.length);
                return Object.assign(Ran, {
                    StartContainerNodeSteps: CSteps.concat(),
                      EndContainerNodeSteps: CSteps.concat()
                });
            }
        }
    };
    static BlockMark = '\u200B'; // U+200B (ZERO WIDTH SPACE)
    static FoundMark = '\u200E'; // U+200E (LEFT-TO-RIGHT MARK)
    static BreakMark = '\u200F'; // U+200F (RIGHT-TO-LEFT MARK)
    static BreakHTML = `<span class="break"> </span>`;
    static CompressOption = this.opt({ Strict: true, ConvertBreaksTo: this.BreakMark });
    static CompressReplacements = [
        [                                      / +/g  ,            ' '],
        [new RegExp(' '  + this.BreakMark,        'g'), this.BreakMark],
        [new RegExp(       this.BreakMark + ' ',  'g'), this.BreakMark],
        [new RegExp(       this.BreakMark + '+',  'g'), this.BreakMark],
        [new RegExp('^'  + this.BreakMark + ' ?', 'g'),             ''],
        [new RegExp(' ?' + this.BreakMark +  '$', 'g'),             '']
    ];
    static compressText = (Str) => {
        const { flatten, CompressOption, CompressReplacements } = RangefinderFocuser;
        Str = flatten(Str, CompressOption).trim();
        for(const Rep of CompressReplacements) Str = Str.replace(...Rep);
        return Str;
    };
    static markupBreak = (Str) => {
        const { BreakMark, BreakHTML } = RangefinderFocuser;
        return Str.replace(new RegExp(BreakMark, 'g'), BreakHTML);
    }
    static stepDown = (From, Steps) => Steps.reduce((To, Step) => To.childNodes[Step], From);
    searchDocument = (...Args) => { // [default] searchContent
        const { Search, FoundMark, BlockMark, Result, opt, compressText, stepDown, markupBreak } = RangefinderFocuser;
        const Doc = Args[0]?.nodeType === 9 ? Args.shift() : Args[0]?.nodeType === 1 ? Args.shift().ownerDocument : document;
        const { Strings, Options } = Args[0] instanceof Search ? Args[0] : new Search(Args[0]);
        const Opt = opt(Options);
        const Results = [];
        return Promise.all(Strings.map(async (Str) => {
            if(typeof Str !== 'string') Str = Number.isFinite(Str) ? String(Str) : '';  if(!Str) return;
            const Mirror = Doc.importNode(Doc.body, true); // const Mirror = Doc.createDocumentFragment().appendChild(Doc.createElement('html')).appendChild(Doc.importNode(Doc.body, true));
            for(const Img of Mirror.querySelectorAll('img'   )) Img.replaceWith(Object.assign(Doc.createTextNode(Img.alt || ''), { ImgAlt: true })); // for Images
            for(const RTC of Mirror.querySelectorAll('rtc'   )) RTC.replaceWith(Doc.createTextNode('')); // for Rubies
            for(const RTP of Mirror.querySelectorAll('rt, rp')) RTP.replaceWith(Doc.createTextNode('')); // for Rubies
            const ComBodyTxt = compressText(Mirror.textContent), ComBodyTxtLength = ComBodyTxt.length;
            const ComStrLength = compressText(Str).length;
            let MRan; while(MRan = this.findRange(Str, Mirror, Opt)) {
                const { StartContainerNodeSteps: SSteps, startContainer: MSCon } = MRan;  let { startOffset: SOffset } = MRan;
                const {   EndContainerNodeSteps: ESteps,   endContainer: MECon } = MRan;  let {   endOffset: EOffset } = MRan;
                MSCon.textContent = MSCon.textContent.slice(0, SOffset) + FoundMark + MSCon.textContent.slice(SOffset + 1); // Mark for the excerption & blocking.
                const Searched_SOffset = compressText(Mirror.textContent).indexOf(FoundMark);
                let   Excerpts_SOffset = Math.max(Searched_SOffset - 12, 0);
                const Excerpts_EOffset = Math.min(Excerpts_SOffset + 69, ComBodyTxtLength);
                //    Excerpts_SOffset = Math.max(Excerpts_EOffset - 69, 0);
                const Searched_EOffset = Math.min(Searched_SOffset + ComStrLength, Excerpts_EOffset);
                const Excerpts = [
                    Excerpts_SOffset > 0 ? '...' : '',
                    markupBreak(ComBodyTxt.slice(Excerpts_SOffset, Searched_SOffset)),
                    markupBreak(ComBodyTxt.slice(Searched_SOffset, Searched_EOffset)),
                    markupBreak(ComBodyTxt.slice(Searched_EOffset, Excerpts_EOffset)),
                    Excerpts_EOffset < ComBodyTxtLength ? '...' : ''
                ];
                MSCon.textContent = MSCon.textContent.slice(0, SOffset) + BlockMark + MSCon.textContent.slice(SOffset + 1); // Unmark+Block for the next cycle.
                if(MSCon.ImgAlt) SSteps.pop(), SOffset = this.getRangeOf(MSCon).startOffset; // for Images
                if(MECon.ImgAlt) ESteps.pop(), EOffset = this.getRangeOf(MECon).endOffset  ; // for Images
                const Ran = new Range();
                Ran.setStart(stepDown(Doc.body, SSteps), SOffset);
                  Ran.setEnd(stepDown(Doc.body, ESteps), EOffset);
                Results.push({
                    Index: undefined, // IndexInTheDocument. To be set after sorting.
                    Range: Ran,
                    Excerpts
                });
            }
        })).then(() => Results.sort((_A, _B) => _A.Range.compareBoundaryPoints(Range.START_TO_START, _B.Range) || _A.Range.compareBoundaryPoints(Range.END_TO_END, _B.Range)).map((Res, Index) => new Result(Object.assign(Res, { Index }))));
    };
    static Result = class {
        Index;
        Range;
        Excerpts;
        constructor({ Index, Range, Excerpts } = {}) {
            if(Number.isInteger(Index) && 0 <= Index) this.Index    = Index;
            if(Range?.cloneRange)                    (this.Range    = Range).Result = this;
            if(Array.isArray(Excerpts))               this.Excerpts = Excerpts;
        }
    };
    static Search = class {
        Strings = [];
        Letters = '';
        Options = {};
        Results = [];
        FocusOn = null;
        static distillStrings = (Strings) => {
            const { flatten } = RangefinderFocuser;
            return [...new Set(Strings.map(Str => Str && (Str = Str.replace(/^\s+$/g, '')) && flatten(Str)))].filter(Boolean).sort((_A, _B) => _A.length - _B.length || (_A <= _B ? -1 : 1));
        };
        static distill = (Settings) => {
            const { Search, Result, opt } = RangefinderFocuser;
            const Distilled = {};
            if(!Settings || typeof Settings !== 'object') return Distilled;
            let { Strings, Results } = Settings;
            const { Letters,  Options, FocusOn } = Settings;
                 if(typeof Letters === 'string')      Distilled.Strings = !Letters ? [] : Search.distillStrings(Letters.split('<OR>')), Distilled.Letters = Letters             ;
            else if(Array.isArray(Strings)) Strings = Distilled.Strings =                 Search.distillStrings(Strings              ), Distilled.Letters = Strings.join('<OR>');
            if(typeof Options === 'object') Distilled.Options = opt(Options);
            if(Array.isArray(Results)) Distilled.Results = Results; else Results = undefined;
            if(FocusOn instanceof Result ? !Results || Results.includes(FocusOn) : FocusOn === null) Distilled.FocusOn = FocusOn;
            return Distilled;
        };
        constructor(Settings) {
            Object.assign(this, RangefinderFocuser.Search.distill(Settings));
        }
    };
    static isSameSearch = (Search_A, Search_B) => {
        const SOpts_A = Search_A.Options;
        const SOpts_B = Search_B.Options;
        for(const k in Object.assign({}, SOpts_A, SOpts_B)) if(SOpts_A[k] !== SOpts_B[k]) return false;
        return Search_A.Strings.join('<OR>') === Search_B.Strings.join('<OR>');
    };
    updateCurrentSearch = (Updates) => {
        const { Search } = RangefinderFocuser;
             if(Updates === null) Updates = new Search(); // CLEAR
        else if(!Updates)         Updates = undefined;
        else {
            Updates = Search.distill(Updates);
            if(!Object.entries(Updates).filter(([_K, _V]) => _V !== undefined && _V !== this.CurrentSearch[_K] ? true : delete Updates[_K] && false).length) Updates = undefined;
        }
        if(Updates) {
            const { Results, FocusOn } = Updates;
            if(Results !== undefined) {
                this.removeAllPaints(/* Delete: */ true);
                for(const Result of Results) this.paint(Result.Range);
            }
            if(FocusOn !== undefined) {
                const  FocusedRange = this.CurrentSearch.FocusOn?.Range;
                const FocusingRange = FocusOn?.Range;
                if(FocusingRange !== FocusedRange) {
                    this.paint( FocusedRange, { Emphasized: false });
                    this.paint(FocusingRange, { Emphasized: true  });
                }
            }
            Object.assign(this.CurrentSearch, Updates);
            this.EventManager.dispatch(this.Prefix + ':updated-search-status', this.CurrentSearch);
        }
        return this.CurrentSearch;
    };
    search = async (Letters, Options) => { // Options is mixed of search-options and behavior-options
        const { Search, isSameSearch } = RangefinderFocuser;
        this.EventManager.dispatch(this.Prefix + ':is-not-searching');
        const NewSearch = new Search({ Letters, Options });
        const Strings = NewSearch.Strings;
        if(!Strings.length) return this.updateCurrentSearch(null);
        this.EventManager.dispatch(this.Prefix + ':is-going-to:search', NewSearch);
        if(isSameSearch(NewSearch, this.CurrentSearch)) {
            if(Letters !== this.CurrentSearch.Letters) this.updateCurrentSearch({ Letters });
        } else {
            this.updateCurrentSearch(NewSearch);
            const Times = Strings[0].length === 1 ? [0, 99] : [99, 0];
            this.EventManager.dispatch(this.Prefix + ':is-searching', Times[0]);
            await new Promise(resolve => setTimeout(resolve, Times[1]));
            this.updateCurrentSearch({ Results: await this.searchContent(NewSearch) });
        }
        await this.focusOnTheSearchResult(...(() => {
            const Focus = Options?.Focus;
            switch(typeof Focus) {
                case 'number': return [this.CurrentSearch.Results[Focus]];
                case 'string': switch(Focus) {
                    case 'first'        : return [this.CurrentSearch.Results[0]];
                    case  'last'        : return [this.CurrentSearch.Results.slice(-1)[0]];
                    case 'auto-reverse' : return [undefined, { Reverse: true }];
                }
            }
            return [undefined]; // default: "auto"
        })());
        this.EventManager.dispatch(this.Prefix + ':searched', this.CurrentSearch);
        this.EventManager.dispatch(this.Prefix + ':is-not-searching');
        return this.CurrentSearch;
    };
    focusOnTheSearchResult = (Result, { Reverse } = {}) => {
        if(!Result?.Range) { // AutoFocus
            const { Results, FocusOn } = this.CurrentSearch; /**/ if(!Results.length) return Promise.resolve();
            Result = Results[
                FocusOn && this.isInCurrentView(FocusOn.Range)
                    ? (FocusOn.Index + (Reverse ? -1 : 1) + Results.length) % Results.length
                    : this.getNearestSearchResultIndex({ Reverse })
            ];
        }
        this.updateCurrentSearch({ FocusOn: Result });
        return this.isInCurrentView(Result.Range) ? Promise.resolve() : this.moveTo(Result.Range);
    };
    getNearestSearchResultIndexInDocument = ({ Reverse } = {}) => { // [default] getNearestSearchResultIndex
        const Results = this.CurrentSearch.Results; /**/ if(!Results.length) return NaN;
        if(Results.length === 1) return 0;
        const NextResultIndex = (() => { switch(getComputedStyle(document.scrollingElement).writingMode.split('-')[0]) {
            case 'horizontal': for(const { Range, Index } of Results) if(0 <= Range.getBoundingClientRect().top                         ) return Index; return 0;
            case   'vertical': for(const { Range, Index } of Results) if(     Range.getBoundingClientRect().right  <= window.innerWidth ) return Index; return 0;
        } })();
        return !Reverse || this.isInCurrentView(Results[NextResultIndex].Range) ? NextResultIndex : (NextResultIndex - 1 + Results.length) % Results.length;
    }
    isInCurrentScrolledView = (Ran) => { // [default] isInCurrentView
        if(!Ran) return false;
        const RangeBCR = Ran.getBoundingClientRect();
        switch(getComputedStyle(document.scrollingElement).writingMode.split('-')[0]) {
            case 'horizontal': return RangeBCR.height < window.innerHeight ? 0 <= RangeBCR.top  && RangeBCR.bottom <= window.innerHeight : RangeBCR.top  <= 0 && window.innerHeight <= RangeBCR.bottom;
            case   'vertical': return RangeBCR.width  < window.innerWidth  ? 0 <= RangeBCR.left && RangeBCR.right  <= window.innerWidth  : RangeBCR.left <= 0 && window.innerWidth  <= RangeBCR.right;
        }
    };
    scrollTo = async (Ran) => this.PaintsOfRangesOfDocuments.get(Ran?.startContainer?.ownerDocument)?.get(Ran)?.firstElementChild?.scrollIntoView({ // [default] moveTo
        behavior: 'smooth',
        block: (() => { switch(getComputedStyle(document.scrollingElement).writingMode.split('-')[0]) {
            case 'horizontal': return window.innerHeight < Ran.getBoundingClientRect().height;
            case   'vertical': return window.innerWidth  < Ran.getBoundingClientRect().width;
        } })() ? 'start' : 'center'
    }) || Promise.reject();
    static specPaint = (Paint, Spec) => {
        if(!Paint) return null;
        if(Spec) Object.keys(Spec).forEach(Sp => Paint.classList.toggle(Sp.toLowerCase(), Paint.Spec[Sp] = Spec[Sp] ? true : false));
        else     Paint.Spec = {}, Paint.removeAttribute('class');
        return Paint;
    };
    static getPaintFragmentRects = (Doc, Ran) => {
        const PaintFragmentRanges = [];
        const CAC = Ran.commonAncestorContainer;
        if(CAC.nodeType === 3) PaintFragmentRanges.push(Ran);
        else {
            const { startContainer: SC, startOffset: SO, endContainer: EC, endOffset: EO } = Ran;
            let Started = false, Ended = false;
            (function _parseElementContent(Ele = CAC.nodeType === 1 ? CAC : CAC.parentElement) {
                ForEachChildNodes: for(const CN of Ele.childNodes) {
                    switch(CN.nodeType) {
                        case 1: switch(CN.tagName.toLowerCase()) { // ElementNode
                            default: _parseElementContent(CN); break;
                            case 'img':
                                const RangeOfImg = new Range(); RangeOfImg.selectNode(CN);
                                const { startOffset: ImgSO, endOffset: ImgEO } = RangeOfImg;
                                if(Ele === SC && ImgSO === SO) Started = true;
                                if(Started) _createAndPushPaintFragmentRange(Ele, ImgSO, ImgEO);
                                if(Ele === EC && ImgEO === EO)   Ended = true;
                        } break;
                        case 3: switch(CN) { // TextNode
                            case SC: Started = true; _createAndPushPaintFragmentRange(SC, SO   ); break;
                            default:     if(Started) _createAndPushPaintFragmentRange(CN       ); break;
                            case EC:   Ended = true; _createAndPushPaintFragmentRange(EC, 0, EO); break;
                        } break;
                    }
                    if(Ended) break ForEachChildNodes;
                }
            })();
            function _createAndPushPaintFragmentRange(Container, StartOffset = 0, EndOffset = Container.textContent.length) {
                if(/^r(tc?|p)$/i.test(Container.parentElement.tagName)) return;
                const FragRange = new Range();
                FragRange.setStart(Container, StartOffset), FragRange.setEnd(Container, EndOffset);
                PaintFragmentRanges.push(FragRange);
            };
        }
        const PaintFragmentRects = []; let LastFragRect = null;
        for(const FragRange of PaintFragmentRanges) {
            const SC = FragRange.startContainer;
            const LineAxis = getComputedStyle(SC.nodeType === 1 ? SC : SC.parentElement).writingMode.split('-')[0];
            for(const FragRect of FragRange.getClientRects()) {
                if(LastFragRect && LineAxis === LastFragRect.LineAxis) switch(LineAxis) { // Same or smaller block-sized FragRect in the same line will be marged to LastFragRect. 2px is for the "tcy"s or so.
                    case 'horizontal': if(LastFragRect.top  - 2 <= FragRect.top  && FragRect.bottom <= LastFragRect.bottom + 2) { LastFragRect.width  = FragRect.right  - LastFragRect.left; continue; } break;
                    case   'vertical': if(LastFragRect.left - 2 <= FragRect.left && FragRect.right  <= LastFragRect.right  + 2) { LastFragRect.height = FragRect.bottom - LastFragRect.top ; continue; } break;
                }
                FragRect.LineAxis = LineAxis;
                PaintFragmentRects.push(LastFragRect = FragRect);
            }
        }
        return PaintFragmentRects;
    };
    PaintContainers = new Map();
    setPaintParent = (...Args) => {
        const Doc    = Args[0]?.nodeType === 9 ? Args.shift() : document;
        const Parent = Args[0]?.nodeType === 1 ? Args[0]      : Doc.querySelector('html > head + body + foot') || Doc.documentElement.insertBefore(Doc.createElement('foot'), Doc.body.nextElementSibling);
        const Container = this.PaintContainers.get(Doc);
        if(!Container) return this.setPaintContainer(Doc, Parent).Parent;
        Container.Parent = Parent;
        if(Container.parentElement !== Parent) Parent.append(Container);
        return Parent;
    };
    setPaintContainer = (Doc = document, Parent) => {
        if(!Parent) return this.setPaintParent(Doc).Container;
        const ContainerTagName = this.Prefix + '-paints', PaintTagName = this.Prefix + '-paint', FragmentTagName = this.Prefix + '-paint-fragment';
        const Style = Doc.head.appendChild(document.createElement('style')).innerHTML = `
            ${ ContainerTagName }, ${ PaintTagName },             ${ FragmentTagName }                        { display: block; margin: 0; border: none 0; padding: 0; overflow: hidden; pointer-events: none !important; }
            ${ ContainerTagName },                                ${ FragmentTagName }                        { position: absolute; mix-blend-mode: multiply; }
            ${ ContainerTagName }                                                                             { z-index: 99999999999; inset: 0; }
                                                                  ${ FragmentTagName }                        { background: yellow; }
                                   ${ PaintTagName }.emphasized > ${ FragmentTagName }                        { background: orange; }
                                                                  ${ FragmentTagName }.horizontal:first-child {    border-top-left-radius: 2px;  border-bottom-left-radius: 2px; }
                                                                  ${ FragmentTagName  }.horizontal:last-child {   border-top-right-radius: 2px; border-bottom-right-radius: 2px; }
                                                                  ${ FragmentTagName   }.vertical:first-child {    border-top-left-radius: 2px;    border-top-right-radius: 2px; }
                                                                  ${ FragmentTagName    }.vertical:last-child { border-bottom-left-radius: 2px; border-bottom-right-radius: 2px; }
        `.trim().replace(/\s{2,}/g, ' ');
        const ScEle = Doc.scrollingElement;
        const Container = Parent.Container = Object.assign(Parent.querySelector(':scope > ' + ContainerTagName) || Parent.appendChild(Doc.createElement(ContainerTagName)), { Parent, Style });
        this.PaintContainers.set(Doc, Container);
        Container.style.width = (Container.Width = ScEle.offsetWidth) + 'px', Container.style.height = (Container.Height = ScEle.offsetHeight) + 'px';
        (this.ResizeObserver || this.setResizeObserver()).observe(ScEle);
        return Container;
    };
    setResizeObserver = () => this.ResizeObserver = new ResizeObserver(Entries => {
        for(const { target: { ownerDocument: Doc, offsetWidth: CurrentW, offsetHeight: CurrentH } } of Entries) {
            const Container = this.PaintContainers.get(Doc);
            const { Width: PrevW, Height: PrevH } = Container;
            if(CurrentW !== PrevW || CurrentH !== PrevH) {
                Container.style.width  = (Container.Width  = CurrentW) + 'px';
                Container.style.height = (Container.Height = CurrentH) + 'px';
                clearTimeout(Container.Timer__repaint);
                Container.Timer__repaint = setTimeout(() => this.repaintDocument(Doc), 99);
            }
        }
    });
    PaintsOfRangesOfDocuments = new Map();
    WasteBasket = document.implementation.createDocument(null, 'sMLRangefinderFocuserWasteBasket', null);
    paint = (Ran, Spec) => {
        const { specPaint, getPaintFragmentRects } = RangefinderFocuser;
        const Doc = Ran?.startContainer?.ownerDocument;
        if(!Doc) return null;
        const DocumentPaintsOfRanges = this.PaintsOfRangesOfDocuments.get(Doc) || this.PaintsOfRangesOfDocuments.set(Doc, new Map()).get(Doc);
        let Paint = DocumentPaintsOfRanges.get(Ran);
        if(Paint) return specPaint(Paint, Spec);
        Paint = specPaint((this.PaintContainers.get(Doc) || this.setPaintContainer(Doc)).appendChild(Object.assign(Doc.createElement(this.Prefix + '-paint'), { Spec: {} })), Spec);
        DocumentPaintsOfRanges.set(Ran, Paint);
        const _PS = 2; // Paint Spreading (px)
        const SE = Doc.scrollingElement;
        for(const FragRect of getPaintFragmentRects(Doc, Ran)) {
            const PaintFragment = Doc.createElement(this.Prefix + '-paint-fragment');
            PaintFragment.className = FragRect.LineAxis;
            for(const [Prop, Adjust] of Object.entries({
                left:   SE.scrollLeft - _PS,
                top:    SE.scrollTop  - _PS,
                width:                  _PS * 2,
                height:                 _PS * 2
            })) PaintFragment.style[Prop] = FragRect[Prop] + Adjust + 'px';
            Paint.appendChild(PaintFragment);
        }
        return Paint;
    };
    removeDocumentPaints = (Doc, Delete) => {
        const DocumentPaintsOfRanges = this.PaintsOfRangesOfDocuments.get(Doc);
        if(!DocumentPaintsOfRanges?.size) return;
        if(Delete) for(const [Ran, Paint] of DocumentPaintsOfRanges.entries()) Paint.remove(), Ran.setStart(this.WasteBasket, 0);
        else       for(const       Paint  of DocumentPaintsOfRanges.values() ) Paint.remove();
        DocumentPaintsOfRanges.clear();
    };
    removeAllPaints = (Delete) => {
        for(const Doc of this.PaintsOfRangesOfDocuments.keys()) this.removeDocumentPaints(Doc, Delete);
    };
    prepareRepaintingDocument = (Doc) => {
        const DocumentPaintsOfRanges = this.PaintsOfRangesOfDocuments.get(Doc);
        if(!DocumentPaintsOfRanges?.size) return null;
        const Orders = [...DocumentPaintsOfRanges.entries()];
        this.removeDocumentPaints(Doc);
        return () => { for(const [Ran, { Spec }] of Orders) this.paint(Ran, Spec); };
    };
    prepareRepaintingAll = () => {
        const DocumentRepaints = [];
        for(const Doc of this.PaintsOfRangesOfDocuments.keys()) {
            const _repaintDocument = this.prepareRepaintingDocument(Doc);
            if(_repaintDocument) DocumentRepaints.push(_repaintDocument);
        }
        if(!DocumentRepaints.length) return null;
        return () => { for(const _repaintDocument of DocumentRepaints) _repaintDocument(); };
    };
    repaintDocument = (Doc) => this.prepareRepaintingDocument(Doc)?.();
    repaintAll      = (   ) => this.prepareRepaintingAll()?.();
    getSelectionOnDocument = (Doc = document) => { // [default] getSelection
        const Sel = Doc.getSelection();
        if(Sel.type === 'Range') return Sel;
    };
    getSelectedText = (Opt = {}) => {
        const Sel = this.getSelection();
        if(!Sel || Sel.type !== 'Range' || !Sel.anchorNode) return '';
        const IncludeImgAlt      = Opt.IncludeImgAlt      !== false;
        const IgnoreRubies       = Opt.IgnoreRubies       !== false;
        const OptimizeLineBreaks = Opt.OptimizeLineBreaks !== false;
        let SelectedText = '';
        if(!IncludeImgAlt && !IgnoreRubies) SelectedText = Sel.toString();
        else {
            const SelCloneDocFragment = Sel.getRangeAt(0).cloneContents();
            if(IncludeImgAlt) SelCloneDocFragment.querySelectorAll(    'img').forEach(Ele => Ele.parentNode.insertBefore(document.createTextNode(Ele.alt), Ele).parentNode.removeChild(Ele));
            if(IgnoreRubies)  SelCloneDocFragment.querySelectorAll( 'rt, rp').forEach(Ele =>                                                                Ele.parentNode.removeChild(Ele));
            SelectedText = SelCloneDocFragment.textContent;
        }
        if(OptimizeLineBreaks) {
            SelectedText = SelectedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');//.replace(/\n{2}/g, '\n').replace(/\n{2,}/g, '\n\n');
            // if(sML.OS.Windows) SelectedText = SelectedText.replace(/\n/g, '\r\n');
        }
        return SelectedText;
    };
};
