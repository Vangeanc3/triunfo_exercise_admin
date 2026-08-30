'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Database,
  Dumbbell,
  Eye,
  EyeOff,
  FolderOpen,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { exerciseDocuments as fallbackExerciseDocuments } from '@/lib/exercise-documents';
import {
  deleteExerciseImage,
  fetchExerciseDocument,
  fetchExerciseDocumentOptions,
  publishExerciseConfig,
  saveExerciseDocument,
  uploadExerciseImage,
} from '@/lib/exercise-repository';
import type {
  ExerciseDefinition,
  ExerciseDocumentOption,
  ExerciseDocument,
  ExerciseVariation,
} from '@/types/exercise';

const levels = ['beginner', 'intermediate', 'advanced'];
const mechanics = ['compound', 'isolation'];
const stimulusOptions = ['lengthened', 'mid', 'shortened', 'isometric'];
type ImageTarget = 'document' | 'exercise' | 'variation';
type DeleteConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => void | Promise<void>;
};
const categoryLabels: Record<string, string> = {
  upper: 'Superiores',
  lower: 'Inferiores',
  core: 'Core',
  mobility: 'Mobilidade',
  stretches: 'Alongamentos',
  functional: 'Funcional',
};

function cloneDocument(document: ExerciseDocument): ExerciseDocument {
  return structuredClone(document);
}

function parseLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatLines(values?: string[]) {
  return values?.join('\n') ?? '';
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function hasVariations(exercise: ExerciseDefinition) {
  return (exercise.variations?.length ?? 0) > 0;
}

function getExerciseDefaultImageUrl(exercise: ExerciseDefinition) {
  if (hasVariations(exercise)) {
    return exercise.variations?.[0]?.imageUrl ?? '';
  }

  return exercise.imageUrl ?? '';
}

function getDocumentDefaultImageUrl(document: ExerciseDocument) {
  if (document.exercises.length === 0) {
    return '';
  }

  const firstExerciseImage = document.exercises
    .map(getExerciseDefaultImageUrl)
    .find(Boolean);

  return firstExerciseImage ?? document.imageUrl;
}

function syncDocumentImageUrl(document: ExerciseDocument) {
  return {
    ...document,
    imageUrl: getDocumentDefaultImageUrl(document),
  };
}

export function ExerciseAdmin() {
  const [documentOptions, setDocumentOptions] = useState<
    ExerciseDocumentOption[]
  >(fallbackExerciseDocuments);
  const [screen, setScreen] = useState<
    'categories' | 'documents' | 'exercises' | 'editor'
  >('categories');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [draft, setDraft] = useState<ExerciseDocument | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [busyCategories, setBusyCategories] = useState<Set<string>>(new Set());
  const [publishingConfig, setPublishingConfig] = useState(false);
  const [mediaBusyKey, setMediaBusyKey] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null);
  const [message, setMessage] = useState('');

  const selectedExercise = useMemo(() => {
    return draft?.exercises.find((exercise) => exercise.id === selectedExerciseId);
  }, [draft, selectedExerciseId]);

  const selectedVariation = selectedExercise?.variations?.[selectedVariationIndex];

  const selectedDocumentOption = useMemo(() => {
    return documentOptions.find((option) => option.id === documentId);
  }, [documentId, documentOptions]);

  const groupedDocumentOptions = useMemo(() => {
    return documentOptions.reduce<
      Record<string, { options: ExerciseDocumentOption[]; allInactive: boolean }>
    >((groups, option) => {
      const key = option.category.toLowerCase();
      if (!groups[key]) {
        groups[key] = { options: [], allInactive: true };
      }
      groups[key].options.push(option);
      if (option.isActive !== false) {
        groups[key].allInactive = false;
      }
      return groups;
    }, {});
  }, [documentOptions]);

  const selectedCategoryData = selectedCategory
    ? groupedDocumentOptions[selectedCategory]
    : null;
  const selectedCategoryOptions = selectedCategoryData?.options ?? [];
  const selectedCategoryLabel =
    categoryLabels[selectedCategory] ?? selectedCategory;

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!draft) return [];
    if (!normalizedQuery) return draft.exercises;

    return draft.exercises.filter((exercise) => {
      const values = [
        exercise.id,
        exercise.name,
        ...exercise.primaryMuscles,
        ...exercise.secondaryMuscles,
        ...(exercise.variations ?? []).flatMap((variation) => [
          variation.id,
          variation.name,
          variation.displayName,
        ]),
      ];

      return values.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [draft, query]);

  async function loadDocumentOptions() {
    try {
      const options = await fetchExerciseDocumentOptions();
      setDocumentOptions(options);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Erro ao buscar documentos no backend: ${error.message}`
          : 'Erro ao buscar documentos no backend.',
      );
    }
  }

  async function loadDocument(nextDocumentId = documentId) {
    try {
      setStatus('loading');
      setMessage('');
      const data = await fetchExerciseDocument(nextDocumentId);
      const cloned = syncDocumentImageUrl(cloneDocument(data));
      setDraft(cloned);
      setSelectedExerciseId(cloned.exercises[0]?.id ?? '');
      setSelectedVariationIndex(0);
      setMessage(`Documento ${nextDocumentId} carregado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar documento.');
      setDraft(null);
      setSelectedExerciseId('');
    } finally {
      setStatus('idle');
    }
  }

  async function publishConfigToApp() {
    try {
      setPublishingConfig(true);
      setMessage('Publicando configuração no app...');

      const result = await publishExerciseConfig();

      setMessage(result.message || 'Configuração publicada no app.');
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Erro desconhecido');
      setMessage(`Erro ao publicar config: ${errorMessage}`);

      throw error;
    } finally {
      setPublishingConfig(false);
    }
  }

  async function saveDocument() {
    if (!draft) return;

    try {
      setStatus('saving');
      setMessage('');
      const syncedDraft = syncDocumentImageUrl(draft);
      await saveExerciseDocument(documentId, syncedDraft);
      setDraft(syncedDraft);
      setDocumentOptions((current) =>
        current.map((option) =>
          option.id === documentId
            ? {
                ...option,
                imageUrl: syncedDraft.imageUrl,
                label: syncedDraft.name,
                isActive: syncedDraft.isActive,
              }
            : option,
        ),
      );
      setMessage(
        `Documento ${documentId} salvo. Clique em "Publicar no app" para enviar ao aplicativo.`,
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Erro ao salvar documento.');
      setMessage(errorMessage);
    } finally {
      setStatus('idle');
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDocumentOptions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadDocument(documentId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  function updateDocument(patch: Partial<ExerciseDocument>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function confirmDelete() {
    if (!deleteConfirmation) return;

    const action = deleteConfirmation.action;
    setDeleteConfirmation(null);
    await action();
  }

  function updateExercise(patch: Partial<ExerciseDefinition>) {
    if (!selectedExercise) return;

    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === selectedExercise.id ? { ...exercise, ...patch } : exercise,
        ),
      };
    });
  }

  function removeSelectedExercise() {
    if (!draft || !selectedExercise) return;

    const selectedExerciseIndex = draft.exercises.findIndex(
      (exercise) => exercise.id === selectedExercise.id,
    );
    const exercises = draft.exercises.filter(
      (exercise) => exercise.id !== selectedExercise.id,
    );
    const nextExercise = exercises[Math.min(selectedExerciseIndex, exercises.length - 1)];
    const nextDraft = syncDocumentImageUrl({ ...draft, exercises });

    setDraft(nextDraft);
    setSelectedExerciseId(nextExercise?.id ?? '');
    setSelectedVariationIndex(0);
    setScreen('exercises');
    setMessage('Exercício removido do rascunho. Salve o documento para alterar o JSON.');
  }

  function updateVariation(patch: Partial<ExerciseVariation>) {
    if (!selectedExercise || !selectedVariation) return;

    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) => {
          if (exercise.id !== selectedExercise.id) return exercise;

          const variations = [...(exercise.variations ?? [])];
          variations[selectedVariationIndex] = {
            ...variations[selectedVariationIndex],
            ...patch,
          };

          return { ...exercise, variations };
        }),
      };
    });
  }

  function removeSelectedVariation() {
    if (!selectedExercise || !selectedVariation) return;

    const nextVariationCount = (selectedExercise.variations?.length ?? 1) - 1;

    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) => {
          if (exercise.id !== selectedExercise.id) return exercise;

          const variations = [...(exercise.variations ?? [])];
          variations.splice(selectedVariationIndex, 1);

          if (variations.length > 0) {
            return { ...exercise, variations };
          }

          const directExercise = { ...exercise };
          delete directExercise.variations;

          return {
            ...directExercise,
            description: selectedVariation.description,
            imageUrl: selectedVariation.imageUrl,
            videoUrl: selectedVariation.videoUrl,
            tips: selectedVariation.tips,
          };
        }),
      };
    });

    setSelectedVariationIndex(Math.max(0, Math.min(selectedVariationIndex, nextVariationCount - 1)));
    setMessage('Variação removida do rascunho. Salve o documento para alterar o JSON.');
  }

  function updateImageTarget(target: ImageTarget, imageUrl: string) {
    if (target === 'document') {
      updateDocument({ imageUrl });
      return;
    }

    if (target === 'exercise') {
      updateExercise({ imageUrl });
      return;
    }

    updateVariation({ imageUrl });
  }

  function getImageOwnerId(target: ImageTarget) {
    if (target === 'document') {
      return documentId;
    }

    if (!selectedExercise) {
      return '';
    }

    if (target === 'exercise') {
      return selectedExercise.name;
    }

    return selectedVariation ? `${selectedExercise.name}/${selectedVariation.name}` : '';
  }

  async function uploadImage(target: ImageTarget, file: File) {
    if (!documentId) return;

    const ownerId = getImageOwnerId(target);
    if (!ownerId) return;

    try {
      setMediaBusyKey(target);
      setMessage('');

      const { imageUrl } = await uploadExerciseImage({
        documentId,
        scope: target === 'document' ? 'category' : target,
        ownerId,
        file,
      });

      updateImageTarget(target, imageUrl);
      setMessage('Imagem enviada para o Storage. Salve o documento para gravar o novo URL.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao enviar imagem.');
    } finally {
      setMediaBusyKey('');
    }
  }

  async function removeImage(target: ImageTarget, imageUrl: string) {
    if (!imageUrl) return;

    try {
      setMediaBusyKey(target);
      setMessage('');

      const { deleted } = await deleteExerciseImage(imageUrl);
      updateImageTarget(target, '');
      setMessage(
        deleted
          ? 'Imagem removida do Storage. Salve o documento para gravar a remoção.'
          : 'URL removida do campo. A imagem não pertence ao Storage configurado.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao remover imagem.');
    } finally {
      setMediaBusyKey('');
    }
  }

  async function toggleCategoryActive(category: string, active: boolean) {
    const options = groupedDocumentOptions[category]?.options ?? [];
    if (options.length === 0) return;

    const label = categoryLabels[category] ?? category;
    if (
      !confirm(
        `${active ? 'Ativar' : 'Desativar'} todos os ${options.length} subgrupos em ${label}?`,
      )
    ) {
      return;
    }

    setBusyCategories((prev) => {
      const next = new Set(prev);
      next.add(category);
      return next;
    });
    setMessage(`Atualizando categoria ${label}...`);

    let savedDocuments = false;

    try {
      for (const option of options) {
        if (option.isActive === active) continue;

        const data = await fetchExerciseDocument(option.id);
        data.isActive = active;
        await saveExerciseDocument(option.id, data);
        savedDocuments = true;
      }

      setDocumentOptions((current) =>
        current.map((opt) =>
          opt.category.toLowerCase() === category.toLowerCase()
            ? { ...opt, isActive: active }
            : opt,
        ),
      );

      setMessage(
        `Categoria ${label} ${active ? 'ativada' : 'desativada'} nos JSONs. Clique em "Publicar no app" para enviar ao aplicativo.`,
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Erro desconhecido');
      setMessage(
        savedDocuments
          ? `Categoria ${label} parcialmente atualizada nos JSONs: ${errorMessage}`
          : `Erro ao atualizar categoria: ${errorMessage}`,
      );
    } finally {
      setBusyCategories((prev) => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    }
  }

  function openCategory(category: string) {
    setSelectedCategory(category);
    setDocumentId('');
    setDraft(null);
    setSelectedExerciseId('');
    setSelectedVariationIndex(0);
    setQuery('');
    setMessage('');
    setScreen('documents');
  }

  function openDocument(option: ExerciseDocumentOption) {
    setDocumentId(option.id);
    setDraft(null);
    setSelectedExerciseId('');
    setSelectedVariationIndex(0);
    setQuery('');
    setMessage('');
    setScreen('exercises');
  }

  function openExercise(exercise: ExerciseDefinition) {
    setSelectedExerciseId(exercise.id);
    setSelectedVariationIndex(0);
    setScreen('editor');
  }

  function goBack() {
    if (screen === 'editor') {
      setScreen('exercises');
      return;
    }

    if (screen === 'exercises') {
      setDocumentId('');
      setDraft(null);
      setSelectedExerciseId('');
      setSelectedVariationIndex(0);
      setQuery('');
      setScreen('documents');
      return;
    }

    if (screen === 'documents') {
      setSelectedCategory('');
      setScreen('categories');
    }
  }

  const previewImage = selectedVariation?.imageUrl || selectedExercise?.imageUrl || '';
  const canSaveDraft = Boolean(draft) && (screen === 'exercises' || screen === 'editor');

  return (
    <main className="screen-shell">
      <header className="topbar">
        <div className="brand">
          <Database size={22} />
          <div>
            <strong>Triunfo Admin</strong>
            <span>Assets de exercícios</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="secondary-button"
            disabled={
              publishingConfig ||
              status !== 'idle' ||
              Boolean(mediaBusyKey) ||
              busyCategories.size > 0
            }
            onClick={() => void publishConfigToApp()}
            type="button"
          >
            {publishingConfig ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <Upload size={18} />
            )}
            Publicar no app
          </button>
          {screen !== 'categories' ? (
            <button className="secondary-button" onClick={goBack} type="button">
              <ArrowLeft size={18} />
              Voltar
            </button>
          ) : null}
          {canSaveDraft ? (
            <>
              {screen === 'editor' ? (
                <button
                  className="icon-button"
                  disabled={status === 'loading'}
                  onClick={() => loadDocument()}
                  title="Recarregar"
                  type="button"
                >
                  {status === 'loading' ? (
                    <Loader2 className="spin" size={18} />
                  ) : (
                    <RefreshCcw size={18} />
                  )}
                </button>
              ) : null}
              <button
                className="primary-button"
                disabled={!draft || status === 'saving' || Boolean(mediaBusyKey)}
                onClick={saveDocument}
                type="button"
              >
                {status === 'saving' ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Salvar
              </button>
            </>
          ) : null}
        </div>
      </header>

      {message ? (
        <div className="notice page-notice">
          {message.includes('Erro') ? (
            <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
          ) : (
            <CheckCircle2 size={18} style={{ color: 'var(--accent)' }} />
          )}
          <span>{message}</span>
        </div>
      ) : null}

      {screen === 'categories' ? (
        <section className="screen-content">
          <div className="screen-heading">
            <h1>Grupos</h1>
          </div>

          <div className="category-card-grid">
            {Object.entries(groupedDocumentOptions).map(
              ([category, { options, allInactive }]) => (
                <div key={category} className="category-card-wrapper">
                  <button
                    className={`category-card ${allInactive ? 'inactive' : ''}`}
                    onClick={() => openCategory(category)}
                    type="button"
                  >
                    <FolderOpen size={24} />
                    <span>
                      {categoryLabels[category] ?? category}
                      <StatusBadge active={!allInactive} small />
                    </span>
                    <small>{options.length} grupos</small>
                  </button>
                  <button
                    className={`category-action-button ${allInactive ? 'inactive' : 'active'}`}
                    disabled={busyCategories.has(category)}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategoryActive(category, allInactive);
                    }}
                    title={allInactive ? 'Ativar tudo' : 'Desativar tudo'}
                    type="button"
                  >
                    {busyCategories.has(category) ? (
                      <Loader2 className="spin" size={16} />
                    ) : allInactive ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      {screen === 'documents' ? (
        <section className="screen-content">
          <div className="screen-heading">
            <h1>{selectedCategoryLabel} (Subgrupos)</h1>
          </div>

          <div className="document-card-grid">
            {selectedCategoryOptions.map((option) => (
              <button
                className={`document-card ${option.isActive === false ? 'inactive' : ''}`}
                key={option.id}
                onClick={() => openDocument(option)}
                type="button"
              >
                {option.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={option.imageUrl} />
                ) : (
                  <div className="document-card-placeholder">
                    <Dumbbell size={26} />
                  </div>
                )}
                <span>
                  {option.label}
                  <StatusBadge active={option.isActive !== false} />
                </span>
                <small>{option.id}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {screen === 'exercises' ? (
        <section className="screen-content">
          <div className="screen-heading with-actions">
            <div>
              <h1>{draft?.name ?? selectedDocumentOption?.label ?? 'Exercícios'}</h1>
              <p>{documentId}</p>
            </div>
            <button
              className="icon-button"
              disabled={status === 'loading'}
              onClick={() => loadDocument()}
              title="Recarregar"
              type="button"
            >
              {status === 'loading' ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <RefreshCcw size={18} />
              )}
            </button>
          </div>

          <div className="search-box screen-search">
            <Search size={18} />
            <input
              disabled={!draft}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar exercícios por nome ou músculo..."
            />
          </div>

          {draft ? (
            <div className="exercise-card-grid">
              {filteredExercises.map((exercise) => {
                const imageUrl = getExerciseDefaultImageUrl(exercise);
                return (
                  <button
                    className="exercise-card"
                    key={exercise.id}
                    onClick={() => openExercise(exercise)}
                    type="button"
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={imageUrl} />
                    ) : (
                      <div className="exercise-card-placeholder">
                        <ImageIcon size={24} />
                      </div>
                    )}
                    <div className="exercise-card-content">
                      <span>
                        {exercise.name}
                      </span>
                      <small>
                        {exercise.id}
                        {hasVariations(exercise) ? ` · ${exercise.variations?.length} variações` : ''}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">Carregando exercícios.</div>
          )}
        </section>
      ) : null}

      {screen === 'editor' ? (
        <section className="screen-content">
          <div className="screen-heading">
            <h1>{selectedExercise?.name ?? 'Exercício'}</h1>
            <p>
              {selectedCategoryLabel}
              {selectedDocumentOption ? ` / ${selectedDocumentOption.label}` : ''}
              {selectedExercise ? ` / ${selectedExercise.id}` : ''}
            </p>
          </div>

          {draft && selectedExercise ? (
          <div className="editor-grid">
            <section className="panel">
              <div className="panel-title">
                <ListChecks size={18} />
                Subgrupo
              </div>
              <TextField label="Nome do subgrupo muscular" value={draft.name} onChange={(name) => updateDocument({ name })} />
              <CheckboxField label="Subgrupo ativo no aplicativo" value={draft.isActive !== false} onChange={(isActive) => updateDocument({ isActive })} />
            </section>

            <section className="panel">
              <div className="panel-title with-action">
                <span className="panel-title-label">
                  <ListChecks size={18} />
                  Exercício
                </span>
                <button
                  className="danger-button"
                  disabled={Boolean(mediaBusyKey)}
                  onClick={() =>
                    setDeleteConfirmation({
                      title: 'Remover exercício',
                      message: `Remover "${selectedExercise.name}" deste documento?`,
                      confirmLabel: 'Remover exercício',
                      action: removeSelectedExercise,
                    })
                  }
                  type="button"
                >
                  <Trash2 size={16} />
                  Remover exercício
                </button>
              </div>
              <div className="two-columns">
                <TextField label="ID" value={selectedExercise.id} onChange={(id) => updateExercise({ id })} />
                <TextField label="Nome" value={selectedExercise.name} onChange={(name) => updateExercise({ name })} />
              </div>
              <div className="two-columns">
                <TextField label="Região" value={selectedExercise.region} onChange={(region) => updateExercise({ region })} />
                <SelectField label="Level" options={levels} value={selectedExercise.level} onChange={(level) => updateExercise({ level })} />
              </div>
              <div className="two-columns">
                <SelectField label="Mechanic" options={mechanics} value={selectedExercise.mechanic} onChange={(mechanic) => updateExercise({ mechanic })} />
                <SelectField label="Stimulus" options={stimulusOptions} value={selectedExercise.stimulus} onChange={(stimulus) => updateExercise({ stimulus })} />
              </div>
              <ArrayField label="Músculos primários" value={selectedExercise.primaryMuscles} onChange={(primaryMuscles) => updateExercise({ primaryMuscles })} />
              <ArrayField label="Músculos secundários" value={selectedExercise.secondaryMuscles} onChange={(secondaryMuscles) => updateExercise({ secondaryMuscles })} />
              <ArrayField label="Erros comuns" value={selectedExercise.commonMistakes} onChange={(commonMistakes) => updateExercise({ commonMistakes })} />
            </section>

            <section className="panel">
              <div className="panel-title">
                <ImageIcon size={18} />
                Mídia
              </div>
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="preview-image" src={previewImage} />
              ) : (
                <div className="image-placeholder">Sem imagem</div>
              )}
              <div className="media-hint">
                <Video size={16} />
                {selectedVariation?.videoUrl || selectedExercise.videoUrl || 'Sem vídeo'}
              </div>
            </section>

            {hasVariations(selectedExercise) && selectedVariation ? (
              <section className="panel wide">
                <div className="panel-title with-action">
                  <span className="panel-title-label">
                    <ListChecks size={18} />
                    Variação
                  </span>
                  <button
                    className="danger-button"
                    disabled={Boolean(mediaBusyKey)}
                    onClick={() =>
                      setDeleteConfirmation({
                        title: 'Remover variação',
                        message: `Remover "${selectedVariation.displayName}" deste exercício?`,
                        confirmLabel: 'Remover variação',
                        action: removeSelectedVariation,
                      })
                    }
                    type="button"
                  >
                    <Trash2 size={16} />
                    Remover variação
                  </button>
                </div>
                <div className="variation-tabs">
                  {selectedExercise.variations?.map((variation, index) => (
                    <button
                      className={index === selectedVariationIndex ? 'selected' : ''}
                      key={variation.id}
                      onClick={() => setSelectedVariationIndex(index)}
                      type="button"
                    >
                      {variation.name}
                    </button>
                  ))}
                </div>
                <div className="two-columns">
                  <TextField label="ID" value={selectedVariation.id} onChange={(id) => updateVariation({ id })} />
                  <TextField label="Nome curto" value={selectedVariation.name} onChange={(name) => updateVariation({ name })} />
                </div>
                <TextField label="Nome exibido" value={selectedVariation.displayName} onChange={(displayName) => updateVariation({ displayName })} />
                <TextareaField label="Descrição" value={selectedVariation.description} onChange={(description) => updateVariation({ description })} />
                <div className="two-columns">
                  <ImageField
                    busy={mediaBusyKey === 'variation'}
                    label="Imagem"
                    value={selectedVariation.imageUrl}
                    onDelete={() =>
                      setDeleteConfirmation({
                        title: 'Remover imagem',
                        message: `Remover a imagem de "${selectedVariation.displayName}"?`,
                        confirmLabel: 'Remover imagem',
                        action: () => removeImage('variation', selectedVariation.imageUrl),
                      })
                    }
                    onUpload={(file) => uploadImage('variation', file)}
                    onUrlChange={(imageUrl) => updateVariation({ imageUrl })}
                  />
                  <TextField label="Vídeo" value={selectedVariation.videoUrl} onChange={(videoUrl) => updateVariation({ videoUrl })} />
                </div>
                <ArrayField label="Dicas" value={selectedVariation.tips} onChange={(tips) => updateVariation({ tips })} />
              </section>
            ) : (
              <section className="panel wide">
                <div className="panel-title">
                  <ListChecks size={18} />
                  Execução direta
                </div>
                <TextareaField label="Descrição" value={selectedExercise.description ?? ''} onChange={(description) => updateExercise({ description })} />
                <div className="two-columns">
                  <ImageField
                    busy={mediaBusyKey === 'exercise'}
                    label="Imagem"
                    value={selectedExercise.imageUrl ?? ''}
                    onDelete={() =>
                      setDeleteConfirmation({
                        title: 'Remover imagem',
                        message: `Remover a imagem de "${selectedExercise.name}"?`,
                        confirmLabel: 'Remover imagem',
                        action: () => removeImage('exercise', selectedExercise.imageUrl ?? ''),
                      })
                    }
                    onUpload={(file) => uploadImage('exercise', file)}
                    onUrlChange={(imageUrl) => updateExercise({ imageUrl })}
                  />
                  <TextField label="Vídeo" value={selectedExercise.videoUrl ?? ''} onChange={(videoUrl) => updateExercise({ videoUrl })} />
                </div>
                <ArrayField label="Dicas" value={selectedExercise.tips ?? []} onChange={(tips) => updateExercise({ tips })} />
              </section>
            )}
          </div>
          ) : (
            <div className="empty-state">Selecione um exercício.</div>
          )}
        </section>
      ) : null}

      {deleteConfirmation ? (
        <ConfirmDeleteDialog
          confirmation={deleteConfirmation}
          onCancel={() => setDeleteConfirmation(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </main>
  );
}

function ConfirmDeleteDialog({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: DeleteConfirmation;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby="delete-confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <div className="confirm-dialog-title" id="delete-confirm-title">
          <Trash2 size={18} />
          {confirmation.title}
        </div>
        <p>{confirmation.message}</p>
        <div className="confirm-dialog-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className="danger-button solid" onClick={onConfirm} type="button">
            <Trash2 size={16} />
            {confirmation.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function ImageField({
  busy,
  label,
  value,
  onDelete,
  onUpload,
  onUrlChange,
}: {
  busy: boolean;
  label: string;
  value: string;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onUrlChange: (value: string) => void;
}) {
  return (
    <div className="image-field">
      <label className="field">
        <span>{label}</span>
        <input value={value} onChange={(event) => onUrlChange(event.target.value)} />
      </label>
      <div className="image-actions">
        <label className={busy ? 'file-button disabled' : 'file-button'}>
          {busy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
          Enviar
          <input
            accept="image/*"
            disabled={busy}
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <button
          className="danger-button"
          disabled={busy || !value}
          onClick={onDelete}
          type="button"
        >
          {busy ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
          Remover
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ active, small }: { active: boolean; small?: boolean }) {
  if (active) return null;
  return <span className={`status-badge ${small ? 'small' : ''}`}>Inativo</span>;
}

function CheckboxField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="field checkbox-field">
      <input
        checked={value}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
      {value ? (
        <Check size={14} style={{ color: 'var(--accent)', marginLeft: 'auto' }} />
      ) : (
        <EyeOff size={14} style={{ color: 'var(--muted)', marginLeft: 'auto' }} />
      )}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ArrayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        className="compact"
        value={formatLines(value)}
        onChange={(event) => onChange(parseLines(event.target.value))}
      />
    </label>
  );
}
