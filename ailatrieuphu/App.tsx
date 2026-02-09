import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, Question, LifelineState, GameConfig } from './types';
import { fetchGameQuestions } from './services/geminiService';
import { audioService } from './services/audioService';
import PrizeLadder from './components/PrizeLadder';
import AnswerOption from './components/AnswerOption';
import Lifelines from './components/Lifelines';
import Timer from './components/Timer';
import AudiencePollModal from './components/AudiencePollModal';
import PhoneFriendModal from './components/PhoneFriendModal';
import { PlayIcon, RestartIcon, HomeIcon, HelpIcon } from './components/Icons';
import GameCreator from './components/GameCreator';
import QuestionReview from './components/QuestionReview';
import PlayerSelection from './components/PlayerSelection';
import MilestoneModal from './components/MilestoneModal';
import Fireworks from './components/Fireworks';
import HelpModal from './components/HelpModal';

const initialLifelines: LifelineState = {
  fiftyFifty: true,
  phoneAFriend: true,
  askTheAudience: true,
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.CREATOR);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [lifelines, setLifelines] = useState<LifelineState>(initialLifelines);
  const [disabledAnswers, setDisabledAnswers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showAudiencePoll, setShowAudiencePoll] = useState(false);
  const [audiencePollData, setAudiencePollData] = useState<{ option: string; percentage: number }[]>([]);
  const [showPhoneFriend, setShowPhoneFriend] = useState(false);
  const [phoneFriendSuggestion, setPhoneFriendSuggestion] = useState('');
  
  const [prizeLevels, setPrizeLevels] = useState<string[]>([]);
  const [safeLevels, setSafeLevels] = useState<number[]>([]);
  const [gameOverMessage, setGameOverMessage] = useState<string>('');
  const [isIntroAnimationComplete, setIsIntroAnimationComplete] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
  const [playerInput, setPlayerInput] = useState<string>('');

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestoneMessage, setMilestoneMessage] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [questions, currentQuestionIndex]);

  useEffect(() => {
    // When the question changes, tell MathJax v3 to re-render the math formulas.
    // This is necessary because React updates the DOM dynamically.
    if (typeof (window as any).MathJax?.typeset === 'function') {
      (window as any).MathJax.typeset();
    }
  }, [currentQuestion]);

  const generatePrizeAndSafeLevels = (count: number) => {
      const pLevels = ["$100", "$200", "$300", "$500", "$1,000", "$2,000", "$4,000", "$8,000", "$16,000", "$32,000", "$64,000", "$125,000", "$250,000", "$500,000", "$1,000,000"];
      setPrizeLevels(pLevels.slice(0, count));

      const newSafeLevels = [4, 9, 14].filter(sl => sl < count);
      if (count > 0 && !newSafeLevels.includes(count - 1)) {
        newSafeLevels.push(count - 1);
      }
      setSafeLevels(newSafeLevels);
  };

  const handleCreateGame = useCallback(async (config: GameConfig) => {
    setGameConfig(config);
    setAppState(AppState.LOADING_QUESTIONS);
    setError(null);
    try {
      const fetchedQuestions = await fetchGameQuestions(config.topic, config.questionCount, config.difficulty);
      setGameConfig(prevConfig => ({...prevConfig!, questionCount: fetchedQuestions.length}));
      setQuestions(fetchedQuestions);
      setAppState(AppState.REVIEW);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setAppState(AppState.CREATOR);
    }
  }, []);
  
  const handleReviewConfirm = (finalQuestions: Question[]) => {
      setQuestions(finalQuestions);
      if (gameConfig) {
          generatePrizeAndSafeLevels(finalQuestions.length);
      }
      setAppState(AppState.PLAYER_SELECTION);
  };

  const handlePlayerSelectedAndStart = (playerName: string) => {
    setCurrentPlayer(playerName);
    setIsIntroAnimationComplete(false);
    if(gameConfig?.audio) {
      audioService.loadCustomSounds(gameConfig.audio);
    }
    audioService.startMusic();
    setAppState(AppState.GAME_START);
  };
  
  const startGame = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswerRevealed(false);
    setLifelines(initialLifelines);
    setDisabledAnswers([]);
    setGameOverMessage('');
    setAppState(AppState.PLAYING);
  };
  
  const resetGame = useCallback(() => {
      setAppState(AppState.CREATOR);
      setError(null);
      setGameOverMessage('');
      setIsIntroAnimationComplete(false);
      setCurrentPlayer(null);
      setPlayerInput('');
      audioService.stopMusic();
      audioService.clearCustomSounds();
  }, []);

  const handlePlayAgain = () => {
    audioService.playSound('click');
    audioService.stopMusic();
    const allPlayers = playerInput.split('\n').map(name => name.trim()).filter(Boolean);
    const remainingPlayers = allPlayers.filter(name => name !== currentPlayer);
    setPlayerInput(remainingPlayers.join('\n'));

    // Reset game-specific state
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswerRevealed(false);
    setLifelines(initialLifelines);
    setDisabledAnswers([]);
    setGameOverMessage('');
    setCurrentPlayer(null);
    
    setAppState(AppState.PLAYER_SELECTION);
};

 const goToNextQuestion = useCallback(() => {
    setCurrentQuestionIndex(prev => prev + 1);
    setSelectedAnswer(null);
    setIsAnswerRevealed(false);
    setDisabledAnswers([]);
    setAppState(AppState.PLAYING);
  }, []);

  const handleCloseMilestoneModal = () => {
    setShowMilestoneModal(false);
    setTimeout(goToNextQuestion, 500); // Wait for modal animation
  };

  const handleAnswerSelect = (index: number) => {
    if (appState !== AppState.PLAYING) return;
    audioService.playSound('buzz');
    setAppState(AppState.ANSWER_SELECTED);
    setSelectedAnswer(index);
    setTimeout(() => {
      setIsAnswerRevealed(true);
      const isCorrect = index === currentQuestion.correctAnswerIndex;
      if (isCorrect) {
        const isFinalQuestion = currentQuestionIndex === questions.length - 1;
        const isMilestone = safeLevels.includes(currentQuestionIndex) && !isFinalQuestion;

        if (isFinalQuestion) {
            audioService.playSound('win');
            setGameOverMessage(`CHÚC MỪNG! BẠN LÀ TRIỆU PHÚ VỚI ${prizeLevels[questions.length-1]}!`);
            setAppState(AppState.GAME_OVER);
        } else if (isMilestone) {
            audioService.playSound('correct');
            setMilestoneMessage(`Bạn đã chắc chắn có ${prizeLevels[currentQuestionIndex]}!`);
            setShowMilestoneModal(true);
        } else {
            audioService.playSound('correct');
            setTimeout(goToNextQuestion, 3000);
        }
      } else {
        audioService.playSound('incorrect');
        setTimeout(() => setAppState(AppState.GAME_OVER), 3000);
      }
    }, 2000);
  };

  const handleStopGame = () => {
    if (appState !== AppState.PLAYING) return;
    audioService.playSound('click');
    const prizeWon = currentQuestionIndex > 0 ? prizeLevels[currentQuestionIndex - 1] : "$0";
    setGameOverMessage(`Bạn đã dừng cuộc chơi và ra về với ${prizeWon}.`);
    setAppState(AppState.GAME_OVER);
  };

  const handleTimeUp = useCallback(() => {
    if (appState === AppState.PLAYING) {
      audioService.playSound('incorrect');
      setAppState(AppState.GAME_OVER);
    }
  }, [appState]);

  const handleFiftyFifty = () => {
    if (!lifelines.fiftyFifty || appState !== AppState.PLAYING) return;
    audioService.playSound('click');
    const correctAnswer = currentQuestion.correctAnswerIndex;
    const wrongAnswers = [0, 1, 2, 3].filter(i => i !== correctAnswer);
    wrongAnswers.sort(() => 0.5 - Math.random());
    const answerToKeep = wrongAnswers[0];
    setDisabledAnswers([0, 1, 2, 3].filter(i => i !== correctAnswer && i !== answerToKeep));
    setLifelines(prev => ({ ...prev, fiftyFifty: false }));
  };
  
  const handlePhoneAFriend = () => {
    if (!lifelines.phoneAFriend || appState !== AppState.PLAYING) return;
    audioService.playSound('click');
    const options = ['A', 'B', 'C', 'D'];
    const correctAnswerIndex = currentQuestion.correctAnswerIndex;
    const isCorrectSuggestion = Math.random() < 0.8;
    if(isCorrectSuggestion) {
      setPhoneFriendSuggestion(options[correctAnswerIndex]);
    } else {
      const wrongOptions = options.filter((_, i) => i !== correctAnswerIndex);
      setPhoneFriendSuggestion(wrongOptions[Math.floor(Math.random() * wrongOptions.length)]);
    }
    setShowPhoneFriend(true);
    setLifelines(prev => ({ ...prev, phoneAFriend: false }));
  };

  const handleAskTheAudience = () => {
    if (!lifelines.askTheAudience || appState !== AppState.PLAYING) return;
    audioService.playSound('click');
    const options = ['A', 'B', 'C', 'D'];
    const correctAnswerIndex = currentQuestion.correctAnswerIndex;
    let percentages = [0, 0, 0, 0];
    let remaining = 100;
    const correctPercentage = Math.floor(Math.random() * 30) + 50;
    percentages[correctAnswerIndex] = correctPercentage;
    remaining -= correctPercentage;
    const wrongIndices = [0, 1, 2, 3].filter(i => i !== correctAnswerIndex);
    wrongIndices.forEach((idx, i) => {
        if (i === wrongIndices.length - 1) {
            percentages[idx] = remaining;
        } else {
            const randomPercent = Math.floor(Math.random() * remaining);
            percentages[idx] = randomPercent;
            remaining -= randomPercent;
        }
    });
    setAudiencePollData(options.map((option, i) => ({ option, percentage: percentages[i] })));
    setShowAudiencePoll(true);
    setLifelines(prev => ({ ...prev, askTheAudience: false }));
  };

  const renderGameScreen = () => {
    if (!currentQuestion || !gameConfig) return renderLoading("Đang tải trò chơi...");

    const questionText = currentQuestion.question;
    const questionLength = questionText.length;

    let questionFontSizeClass = "text-3xl md:text-4xl";
    if (questionLength > 150) {
        questionFontSizeClass = "text-xl md:text-2xl";
    } else if (questionLength > 80) {
        questionFontSizeClass = "text-2xl md:text-3xl";
    }

    return (
        <div className="w-full h-screen flex flex-col p-2 gap-2 text-white">
            {showAudiencePoll && <AudiencePollModal pollData={audiencePollData} onClose={() => { audioService.playSound('click'); setShowAudiencePoll(false); }} />}
            {showPhoneFriend && <PhoneFriendModal suggestion={phoneFriendSuggestion} onClose={() => { audioService.playSound('click'); setShowPhoneFriend(false); }} />}
            {showMilestoneModal && <MilestoneModal prize={milestoneMessage} onClose={handleCloseMilestoneModal} />}
            
            <header className="flex justify-between items-center w-full px-4 pt-2">
                <div className="flex justify-start ml-16">
                    <button onClick={() => { audioService.playSound('click'); resetGame(); }} className="text-white hover:text-cyan-400 transition-colors" aria-label="Go to Home">
                        <HomeIcon className="w-8 h-8" />
                    </button>
                </div>

                <div className="flex justify-end">
                    <Lifelines lifelines={lifelines} onFiftyFifty={handleFiftyFifty} onPhoneAFriend={handlePhoneAFriend} onAskTheAudience={handleAskTheAudience} />
                </div>
            </header>

            <main className="flex-1 flex w-full gap-4 overflow-hidden">
                <div className="w-40 flex-shrink-0 flex flex-col justify-start items-center pt-16">
                    <div className="relative w-36 h-16 flex items-center justify-center">
                        <svg className="absolute w-full h-full" viewBox="0 0 150 50" preserveAspectRatio="none">
                            <path d="M 15 0 L 135 0 L 150 25 L 135 50 L 15 50 L 0 25 Z" fill="none" stroke="#67e8f9" strokeWidth="2" />
                        </svg>
                        <span className="relative text-yellow-400 font-bold text-2xl">{currentQuestionIndex > 0 ? prizeLevels[currentQuestionIndex - 1] : "$0"}</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-between items-center gap-4 pt-4">
                     <div className="text-center">
                        <h1 className="text-5xl md:text-6xl font-bold text-yellow-400 opacity-20 select-none" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                            AI LÀ TRIỆU PHÚ
                        </h1>
                        {currentPlayer && (
                            <div className="mt-2 text-center">
                                <p className="font-bold text-4xl text-white tracking-wider uppercase">{currentPlayer}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="w-full max-w-5xl mx-auto flex flex-col items-center gap-4 pb-4">
                        <div className="w-full flex items-center justify-center gap-4 mb-2">
                            <div className="relative flex-1 min-h-32 flex items-center justify-center">
                                <svg className="absolute w-full h-full" viewBox="0 0 400 60" preserveAspectRatio="none">
                                    <path d="M 20 0 L 380 0 L 400 30 L 380 60 L 20 60 L 0 30 Z" fill="rgba(1, 42, 94, 0.8)" stroke="#67e8f9" strokeWidth="2" />
                                </svg>
                                <h2 className={`relative text-white text-center font-bold px-12 ${questionFontSizeClass}`}>
                                    {currentQuestion.question}
                                </h2>
                            </div>
                             <Timer 
                                key={currentQuestionIndex} 
                                seconds={gameConfig.timerDuration} 
                                onTimeUp={handleTimeUp}
                                isPaused={appState !== AppState.PLAYING}
                            />
                        </div>

                        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                            {currentQuestion.options.map((option, index) => (
                                <AnswerOption
                                    key={index}
                                    prefix={['A', 'B', 'C', 'D'][index]}
                                    text={option}
                                    onClick={() => handleAnswerSelect(index)}
                                    isSelected={selectedAnswer === index}
                                    isCorrect={index === currentQuestion.correctAnswerIndex}
                                    isRevealed={isAnswerRevealed}
                                    isDisabled={selectedAnswer !== null || disabledAnswers.includes(index)}
                                />
                            ))}
                        </div>
                         <div className="mt-2 text-center">
                            <button
                                onClick={handleStopGame}
                                disabled={selectedAnswer !== null}
                                className="bg-red-600 text-white font-bold py-2 px-6 rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                Dừng cuộc chơi
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="w-64 flex-shrink-0">
                    <PrizeLadder 
                        currentQuestionIndex={currentQuestionIndex} 
                        prizeLevels={prizeLevels}
                        safeLevels={safeLevels}
                        appState={appState}
                    />
                </div>
            </main>
        </div>
    );
  };
  
  const renderGameStartScreen = () => (
    <div className="w-full h-screen flex p-4 gap-4">
        <div className="w-40 flex-shrink-0" />
        <div className="flex-1 flex flex-col justify-center items-center h-full text-white text-center p-4">
            <h1 className="text-5xl md:text-7xl font-bold text-yellow-400" style={{ textShadow: '2px 2px 4px #000' }}>AI LÀ TRIỆU PHÚ</h1>
            <p className="text-cyan-400 mt-2 text-md italic">Trò chơi được tạo bởi Thầy Tình</p>
            <p className="mt-4 text-xl md:text-2xl text-cyan-300">Chúc mừng <span className="font-bold text-yellow-400 uppercase">{currentPlayer}</span>!</p>
            <p className="mt-2 text-lg text-cyan-300">Bộ câu hỏi về chủ đề "{gameConfig?.topic}" đã sẵn sàng!</p>
            {isIntroAnimationComplete && (
                <div className="flex flex-col md:flex-row items-center gap-4 mt-8">
                    <button
                        onClick={() => { audioService.playSound('click'); startGame(); }}
                        className="bg-yellow-500 text-black font-bold py-4 px-8 rounded-full text-2xl flex items-center gap-3 transition-transform transform hover:scale-110 animate-pulse"
                    >
                        <PlayIcon className="w-8 h-8" />
                        Sẵn sàng
                    </button>
                </div>
            )}
        </div>
        <div className="w-64 flex-shrink-0">
            <PrizeLadder 
                currentQuestionIndex={-1} 
                prizeLevels={prizeLevels}
                safeLevels={safeLevels}
                appState={appState}
                onAnimationComplete={() => setIsIntroAnimationComplete(true)}
            />
        </div>
    </div>
  );

  const renderLoading = (text: string) => (
    <div className="flex flex-col justify-center items-center h-full text-white text-center">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-cyan-400"></div>
      <p className="mt-4 text-xl">{text}</p>
    </div>
  );

  const renderGameOver = () => {
    const getGameOverText = () => {
        if (gameOverMessage) return gameOverMessage;

        let lastSafeLevelIndex = -1;
        for (let i = safeLevels.length - 1; i >= 0; i--) {
            if (currentQuestionIndex > safeLevels[i]) {
                lastSafeLevelIndex = safeLevels[i];
                break;
            }
        }
        const prizeWon = lastSafeLevelIndex >= 0 ? prizeLevels[lastSafeLevelIndex] : "$0";
        return `TRÒ CHƠI KẾT THÚC! Bạn ra về với ${prizeWon}.`;
    };

    audioService.stopMusic();
    const isWinner = gameOverMessage.includes('TRIỆU PHÚ');

    return (
        <div className="relative w-full h-full flex flex-col justify-center items-center text-white text-center p-4">
            {isWinner && <Fireworks />}
            <h1 className="text-4xl md:text-6xl font-bold text-yellow-400 mb-8" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>{getGameOverText()}</h1>
            <div className="flex flex-col md:flex-row gap-4">
                <button
                    onClick={handlePlayAgain}
                    className="bg-yellow-500 text-black font-bold py-3 px-8 rounded-full text-xl flex items-center gap-3 transition-transform transform hover:scale-110"
                >
                    <RestartIcon className="w-7 h-7"/>
                    Chơi Lại
                </button>
                <button
                    onClick={() => { audioService.playSound('click'); resetGame(); }}
                    className="bg-cyan-500 text-white font-bold py-3 px-8 rounded-full text-xl flex items-center gap-3 transition-transform transform hover:scale-110"
                >
                    <HomeIcon className="w-7 h-7"/>
                    Trang Chủ
                </button>
            </div>
        </div>
    );
  };

  const getCurrentScreen = () => {
    switch (appState) {
        case AppState.CREATOR:
            return <GameCreator onCreate={handleCreateGame} isLoading={false} error={error} />;
        case AppState.LOADING_QUESTIONS:
            return renderLoading("AI đang tạo câu hỏi...");
        case AppState.REVIEW:
            return gameConfig && <QuestionReview 
                        initialQuestions={questions} 
                        onConfirm={handleReviewConfirm} 
                        onRegenerate={() => gameConfig && handleCreateGame(gameConfig)} 
                        isLoading={false}
                   />;
        case AppState.PLAYER_SELECTION:
            return <PlayerSelection 
                        onPlayerSelected={handlePlayerSelectedAndStart} 
                        playerInput={playerInput}
                        onPlayerInputChange={setPlayerInput}
                    />;
        case AppState.GAME_START:
            return renderGameStartScreen();
        case AppState.PLAYING:
        case AppState.ANSWER_SELECTED:
            return renderGameScreen();
        case AppState.GAME_OVER:
            return renderGameOver();
        default:
            return <GameCreator onCreate={handleCreateGame} isLoading={false} error={error} />;
    }
  };

  return (
    <main className="min-h-screen w-full font-sans overflow-hidden relative">
        <button
            onClick={() => { audioService.playSound('click'); setShowHelpModal(true); }}
            className="fixed top-4 left-4 z-50 w-12 h-12 rounded-full bg-blue-800 bg-opacity-70 border-2 border-cyan-500 text-white flex items-center justify-center transition-transform transform hover:scale-110 hover:bg-cyan-700"
            aria-label="Hướng dẫn chơi"
        >
            <HelpIcon className="w-7 h-7" />
        </button>
        
        {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}

        <div className="container mx-auto h-screen max-w-screen-2xl">
            {getCurrentScreen()}
        </div>
    </main>
  );
};

export default App;