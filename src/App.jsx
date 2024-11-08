import { createSignal, createEffect, onMount, Show } from 'solid-js';
import { supabase, createEvent } from './supabaseClient';
import { Auth } from '@supabase/auth-ui-solid';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { pdfjs } from 'pdfjs-dist/build/pdf';
import 'pdfjs-dist/build/pdf.worker.entry';
import { SolidMarkdown } from 'solid-markdown';

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.8.162/pdf.worker.min.js';

function App() {
  const [user, setUser] = createSignal(null);
  const [currentPage, setCurrentPage] = createSignal('login');
  const [pdfText, setPdfText] = createSignal('');
  const [questions, setQuestions] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  
  const checkUserSignedIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      setCurrentPage('homePage');
    }
  };

  onMount(checkUserSignedIn);

  createEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser(session.user);
        setCurrentPage('homePage');
      } else {
        setUser(null);
        setCurrentPage('login');
      }
    });
    return () => {
      authListener.unsubscribe();
    };
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentPage('login');
  };

  const handleFileUpload = async (e) => {
    setError('');
    setQuestions([]);
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setLoading(true);
      try {
        const fileReader = new FileReader();
        fileReader.onload = async function () {
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjs.getDocument(typedarray).promise;
          let textContent = '';
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            textContent += strings.join(' ') + ' ';
          }
          setPdfText(textContent);
        };
        fileReader.readAsArrayBuffer(file);
      } catch (err) {
        console.error('Error reading PDF:', err);
        setError('خطأ في قراءة الملف. يرجى المحاولة مرة أخرى.');
      } finally {
        setLoading(false);
      }
    } else {
      setError('يرجى تحميل ملف PDF صالح.');
    }
  };

  const handleGenerateQuestions = async () => {
    if (!pdfText()) {
      setError('لا يوجد نص لتحويله إلى أسئلة.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createEvent('chatgpt_request', {
        prompt: `قم بإنشاء أسئلة من النص التالي باللغة العربية: \n\n${pdfText()}\n\nارسل الإجابة في صيغة JSON تحتوي على الأسئلة والأجوبة بالشكل التالي: [{"question": "...", "answer": "..." }, ...]`,
        response_type: 'json'
      });
      setQuestions(result);
    } catch (err) {
      console.error('Error generating questions:', err);
      setError('حدث خطأ أثناء إنشاء الأسئلة. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 p-4">
      <Show
        when={currentPage() === 'homePage'}
        fallback={
          <div class="flex items-center justify-center min-h-screen">
            <div class="w-full max-w-md p-8 bg-white rounded-xl shadow-lg text-right">
              <h2 class="text-3xl font-bold mb-6 text-center text-purple-600">تسجيل الدخول باستخدام ZAPT</h2>
              <a
                href="https://www.zapt.ai"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-500 hover:underline mb-6 block text-center"
              >
                تعرف على المزيد حول ZAPT
              </a>
              <Auth
                supabaseClient={supabase}
                appearance={{ theme: ThemeSupa }}
                providers={['google', 'facebook', 'apple']}
                magicLink={true}
                view="magic_link"
                showLinks={false}
                authView="magic_link"
                localization={{
                  variables: {
                    sign_in: {
                      email_label: 'البريد الإلكتروني',
                      password_label: 'كلمة المرور',
                      button_label: 'تسجيل الدخول',
                      link_text: 'هل نسيت كلمة المرور؟'
                    },
                    magic_link: {
                      email_input_label: 'البريد الإلكتروني',
                      button_label: 'إرسال رابط التسجيل',
                      loading_button_label: 'جارٍ الإرسال...'
                    }
                  }
                }}
              />
            </div>
          </div>
        }
      >
        <div class="max-w-6xl mx-auto text-right">
          <div class="flex justify-between items-center mb-8">
            <h1 class="text-4xl font-bold text-purple-600">تطبيق إنشاء الأسئلة من PDF</h1>
            <button
              class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
              onClick={handleSignOut}
            >
              تسجيل الخروج
            </button>
          </div>

          <div class="bg-white p-6 rounded-xl shadow-md">
            <h2 class="text-2xl font-bold mb-4 text-purple-600">تحميل ملف PDF</h2>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent box-border cursor-pointer"
            />
            <Show when={error()}>
              <p class="text-red-600 mt-2">{error()}</p>
            </Show>
            <Show when={loading()}>
              <p class="text-blue-600 mt-2">جارٍ معالجة الملف، يرجى الانتظار...</p>
            </Show>
            <Show when={pdfText() && !loading()}>
              <button
                onClick={handleGenerateQuestions}
                class="mt-4 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
              >
                إنشاء الأسئلة
              </button>
            </Show>
          </div>

          <Show when={questions().length > 0}>
            <div class="mt-8 bg-white p-6 rounded-xl shadow-md">
              <h2 class="text-2xl font-bold mb-4 text-purple-600">الأسئلة المُنشأة</h2>
              <For each={questions()}>
                {(qa) => (
                  <div class="mb-4 p-4 border-b border-gray-200">
                    <p class="font-semibold text-lg mb-2">{qa.question}</p>
                    <p class="text-gray-700">{qa.answer}</p>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default App;